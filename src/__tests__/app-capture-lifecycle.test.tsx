import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../renderer/App';
import type { CaptureResult, ScreenshotResult } from '../shared/ipc-types';
import { captureAssetUrl } from '../shared/capture-asset';

// Stand-in editor built on the real editor state hook, so the test can see
// whether shapes and undo history survive across capture results.
jest.mock('../renderer/components/editor/ScreenshotEditor', () => {
  const React = jest.requireActual('react');
  const { useEditorState } = jest.requireActual(
    '../renderer/hooks/use-editor-state',
  );
  const assets = jest.requireActual('../shared/capture-asset');
  function EditorStandIn({
    screenshot,
    onDelete,
  }: {
    screenshot: ScreenshotResult;
    onDelete: () => void;
  }) {
    const state = useEditorState();
    const addEllipse = () =>
      state.addShape({
        id: 'ellipse-1',
        type: 'ellipse',
        cx: 10,
        cy: 10,
        rx: 5,
        ry: 5,
        strokeColor: '#ef4444',
        strokeWidth: 2,
      });
    return React.createElement(
      'div',
      null,
      React.createElement('img', {
        alt: 'Screenshot',
        src: assets.captureAssetUrl(screenshot.assetId),
      }),
      React.createElement(
        'span',
        { 'data-testid': 'shape-count' },
        String(state.shapes.length),
      ),
      React.createElement(
        'span',
        { 'data-testid': 'has-undo' },
        String(state.hasUndo),
      ),
      React.createElement(
        'button',
        { type: 'button', onClick: addEllipse },
        'Add ellipse',
      ),
      React.createElement(
        'button',
        { type: 'button', onClick: onDelete },
        'Delete',
      ),
    );
  }
  return { __esModule: true, default: EditorStandIn };
});

const IMAGE_A = '0b7c2d4e-1f3a-4b5c-8d6e-7f8091a2b3c4';
const IMAGE_B = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f2a3b4c5d';
const PERMISSION_MESSAGE =
  'X-Shot needs Screen Recording permission. Turn it on in System Settings.';

type CaptureListener = (result: CaptureResult) => void;

let captureListener: CaptureListener | null = null;
const invoke = jest.fn(async () => undefined);

function success(sessionId: string, assetId: string): CaptureResult {
  return {
    ok: true,
    screenshot: { assetId, width: 4, height: 3, scaleFactor: 1, sessionId },
  };
}

function failure(sessionId: string): CaptureResult {
  return {
    ok: false,
    sessionId,
    reason: 'screen-permission',
    message: PERMISSION_MESSAGE,
  };
}

async function emit(result: CaptureResult) {
  await act(async () => {
    captureListener?.(result);
  });
}

const shownImage = () => screen.getByAltText('Screenshot');
const shapeCount = () => screen.getByTestId('shape-count');
const hasUndo = () => screen.getByTestId('has-undo');

describe('App capture lifecycle', () => {
  beforeEach(() => {
    captureListener = null;
    invoke.mockClear();
    sessionStorage.setItem('xshot:migration-checked', 'true');
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: {
        on: jest.fn((channel: string, listener: CaptureListener) => {
          if (channel === 'capture-result') captureListener = listener;
          return () => {};
        }),
        invoke,
        sendMessage: jest.fn(),
        log: jest.fn(),
      },
    };
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
    sessionStorage.clear();
    localStorage.clear();
  });

  it('keeps the current edit and shows the error when a capture fails', async () => {
    render(<App />);
    await emit(success('session-1', IMAGE_A));
    fireEvent.click(screen.getByRole('button', { name: 'Add ellipse' }));
    expect(shapeCount()).toHaveTextContent('1');

    await emit(failure('session-2'));

    expect(screen.getByRole('alert')).toHaveTextContent(PERMISSION_MESSAGE);
    expect(shownImage()).toHaveAttribute('src', captureAssetUrl(IMAGE_A));
    expect(shapeCount()).toHaveTextContent('1');
    expect(hasUndo()).toHaveTextContent('true');
  });

  it('shows the error and keeps waiting when the first capture fails', async () => {
    render(<App />);
    await emit(failure('session-1'));

    expect(screen.getByRole('alert')).toHaveTextContent(PERMISSION_MESSAGE);
    expect(screen.getByText('Waiting for screenshot…')).toBeInTheDocument();
    expect(screen.queryByAltText('Screenshot')).not.toBeInTheDocument();
  });

  it('starts a fresh editor for each new capture session', async () => {
    render(<App />);
    await emit(success('session-1', IMAGE_A));
    fireEvent.click(screen.getByRole('button', { name: 'Add ellipse' }));
    expect(hasUndo()).toHaveTextContent('true');

    await emit(success('session-2', IMAGE_B));

    expect(shownImage()).toHaveAttribute('src', captureAssetUrl(IMAGE_B));
    expect(shapeCount()).toHaveTextContent('0');
    expect(hasUndo()).toHaveTextContent('false');
  });

  it('resets even when the new capture has identical pixels', async () => {
    render(<App />);
    await emit(success('session-1', IMAGE_A));
    fireEvent.click(screen.getByRole('button', { name: 'Add ellipse' }));

    await emit(success('session-2', IMAGE_A));

    expect(shapeCount()).toHaveTextContent('0');
    expect(hasUndo()).toHaveTextContent('false');
  });

  it('frees the capture in main when the editor discards it', async () => {
    render(<App />);
    await emit(success('session-1', IMAGE_A));

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(invoke).toHaveBeenCalledWith('release-capture-asset', {
      assetId: IMAGE_A,
    });
    expect(screen.getByText('Waiting for screenshot…')).toBeInTheDocument();
  });

  it('clears the error on the next successful capture or on dismiss', async () => {
    render(<App />);
    await emit(failure('session-1'));
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss capture error' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();

    await emit(failure('session-2'));
    await emit(success('session-3', IMAGE_A));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('removes PII masks saved by older versions on startup', () => {
    localStorage.setItem('pii-masks:1000x420:1a2b3c', '[]');
    localStorage.setItem('pii-masks:640x480:4d5e6f', '[{"x":1}]');
    localStorage.setItem('xshot:pii', '{"autoDetect":true}');

    render(<App />);

    expect(localStorage.getItem('pii-masks:1000x420:1a2b3c')).toBeNull();
    expect(localStorage.getItem('pii-masks:640x480:4d5e6f')).toBeNull();
    expect(localStorage.getItem('xshot:pii')).toBe('{"autoDetect":true}');
  });
});

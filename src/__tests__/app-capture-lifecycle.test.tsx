import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../renderer/App';
import type { CaptureResult, ScreenshotResult } from '../shared/ipc-types';

// Stand-in editor built on the real editor state hook, so the test can see
// whether shapes and undo history survive across capture results.
jest.mock('../renderer/components/editor/ScreenshotEditor', () => {
  const React = jest.requireActual('react');
  const { useEditorState } = jest.requireActual(
    '../renderer/hooks/use-editor-state',
  );
  function EditorStandIn({ screenshot }: { screenshot: ScreenshotResult }) {
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
        src: screenshot.imageDataUrl,
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
    );
  }
  return { __esModule: true, default: EditorStandIn };
});

const IMAGE_A = 'data:image/png;base64,QUFBQQ==';
const IMAGE_B = 'data:image/png;base64,QkJCQg==';
const PERMISSION_MESSAGE =
  'X-Shot needs Screen Recording permission. Turn it on in System Settings.';

type CaptureListener = (result: CaptureResult) => void;

let captureListener: CaptureListener | null = null;
let autoCopyToClipboard = false;
const invoke = jest.fn(async (channel: string) =>
  channel === 'get-preferences'
    ? { capture: { autoCopyToClipboard } }
    : undefined,
);

function success(sessionId: string, imageDataUrl: string): CaptureResult {
  return {
    ok: true,
    screenshot: { imageDataUrl, width: 4, height: 3, sessionId },
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
    autoCopyToClipboard = false;
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
  });

  it('keeps the current edit and shows the error when a capture fails', async () => {
    render(<App />);
    await emit(success('session-1', IMAGE_A));
    fireEvent.click(screen.getByRole('button', { name: 'Add ellipse' }));
    expect(shapeCount()).toHaveTextContent('1');

    await emit(failure('session-2'));

    expect(screen.getByRole('alert')).toHaveTextContent(PERMISSION_MESSAGE);
    expect(shownImage()).toHaveAttribute('src', IMAGE_A);
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

    expect(shownImage()).toHaveAttribute('src', IMAGE_B);
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

  it('auto-copies a successful capture when the preference is on', async () => {
    autoCopyToClipboard = true;
    render(<App />);
    await emit(success('session-1', IMAGE_A));

    expect(invoke).toHaveBeenCalledWith('copy-image', { dataUrl: IMAGE_A });
  });
});

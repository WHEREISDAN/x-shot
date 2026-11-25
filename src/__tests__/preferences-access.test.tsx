import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../renderer/App';
import EmptyState from '../renderer/components/EmptyState';
import TopBar from '../renderer/components/editor/TopBar';
import PREFERENCES from './fixtures/preferences';

const invoke = jest.fn(async (channel: string) =>
  channel === 'get-preferences' ? PREFERENCES : true,
);

beforeEach(() => {
  invoke.mockClear();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: {
      invoke,
      on: jest.fn(() => () => {}),
      log: jest.fn(),
    },
    windowControls: {
      minimize: jest.fn(),
      toggleMaximize: jest.fn(),
      close: jest.fn(),
      getState: jest.fn(async () => ({
        isMaximized: false,
        isFullScreen: false,
        isFocused: true,
        platform: 'win32',
      })),
      onState: jest.fn(() => () => {}),
    },
  };
});

afterEach(() => {
  delete (window as unknown as { electron?: unknown }).electron;
});

describe('Preferences window triggers', () => {
  it('opens Preferences when clicking the Preferences button in TopBar', () => {
    render(
      <TopBar
        onUndo={jest.fn()}
        onRedo={jest.fn()}
        canUndo={false}
        canRedo={false}
        onZoomOut={jest.fn()}
        onZoomIn={jest.fn()}
        canZoomOut
        canZoomIn
        viewScalePercent={100}
        censorPII={false}
        setCensorPII={jest.fn()}
        onDelete={jest.fn()}
        onCopy={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
    expect(invoke).toHaveBeenCalledWith('open-preferences-window', undefined);
  });

  it('opens Preferences when clicking the Preferences button in EmptyState', async () => {
    render(<EmptyState />);
    await act(async () => {});

    fireEvent.click(screen.getByRole('button', { name: 'Preferences' }));
    expect(invoke).toHaveBeenCalledWith('open-preferences-window', undefined);
  });

  it('opens Preferences on Ctrl+, or Cmd+, in the main window, except while typing', async () => {
    render(<App />);
    await act(async () => {});

    fireEvent.keyDown(window, { key: ',', ctrlKey: true });
    expect(invoke).toHaveBeenCalledWith('open-preferences-window', undefined);

    invoke.mockClear();
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(input, { key: ',', ctrlKey: true });
    expect(invoke).not.toHaveBeenCalledWith(
      'open-preferences-window',
      undefined,
    );
    input.remove();
  });
});

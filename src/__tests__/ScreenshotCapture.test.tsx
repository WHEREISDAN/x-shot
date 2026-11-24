import '@testing-library/jest-dom';
import { fireEvent, render, screen } from '@testing-library/react';
import ScreenshotCapture from '../renderer/ScreenshotCapture';

const sendMessage = jest.fn();

describe('ScreenshotCapture', () => {
  beforeEach(() => {
    sendMessage.mockClear();
    // An overlay on a secondary (non-primary) display.
    window.location.hash =
      '#/screenshot?offsetX=1920&offsetY=0&displayId=3&primary=0';
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: {
        sendMessage,
        invoke: jest.fn().mockResolvedValue(null),
        log: jest.fn(),
      },
    };
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  it('shows Cancel on every display, not only the primary', () => {
    render(<ScreenshotCapture />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(sendMessage).toHaveBeenCalledWith('screenshot-cancel', undefined);
  });

  it('shows the hint until there is a selection', () => {
    const { container } = render(<ScreenshotCapture />);
    expect(screen.getByText(/Drag to select an area/)).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Capture' }),
    ).not.toBeInTheDocument();

    const overlay = container.firstChild as HTMLElement;
    fireEvent.mouseDown(overlay, { clientX: 40, clientY: 40 });
    fireEvent.mouseMove(overlay, { clientX: 200, clientY: 160 });
    fireEvent.mouseUp(overlay);

    expect(
      screen.queryByText(/Drag to select an area/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Capture' }));
    expect(sendMessage).toHaveBeenCalledWith(
      'screenshot-data',
      expect.objectContaining({ x: 1960, y: 40, displayId: 3 }),
    );
  });

  it('marks the dock button whose panel is open', async () => {
    render(<ScreenshotCapture />);
    const windows = screen.getByRole('button', { name: 'Windows' });
    expect(windows).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(windows);
    expect(windows).toHaveAttribute('aria-pressed', 'true');
    expect(
      await screen.findByRole('dialog', { name: 'Windows' }),
    ).toHaveTextContent('0 open');
    expect(screen.getByText('No items detected')).toBeInTheDocument();
    expect(
      screen.queryByText(/Drag to select an area/),
    ).not.toBeInTheDocument();
  });

  it('cancels on Escape wherever focus is', () => {
    render(<ScreenshotCapture />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sendMessage).toHaveBeenCalledWith('screenshot-cancel', undefined);
  });
});

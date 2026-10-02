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

  it('cancels on Escape wherever focus is', () => {
    render(<ScreenshotCapture />);
    expect(document.activeElement).toBe(document.body);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(sendMessage).toHaveBeenCalledWith('screenshot-cancel', undefined);
  });
});

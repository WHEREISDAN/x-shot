/* eslint-env jest, es2021 */
import '@testing-library/jest-dom';
import { render } from '@testing-library/react';
import ScreenshotCapture from '../renderer/ScreenshotCapture';

// Provide minimal window.electron mock for tests
(globalThis as any).window = {
  location: { hash: '' },
  electron: {
    ipcRenderer: {
      sendMessage: jest.fn(),
      on: jest.fn(),
      once: jest.fn(),
      invoke: jest.fn().mockResolvedValue([]),
    },
  },
  innerWidth: 800,
  innerHeight: 600,
};

describe('ScreenshotCapture', () => {
  it('renders overlay root', () => {
    const { container } = render(<ScreenshotCapture />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

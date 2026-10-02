/**
 * @jest-environment node
 */
import { recaptureLastSelection } from '../main/capture-actions';
import { loadPreferences } from '../main/preferences';
import { startRecapture } from '../main/capture-coordinator';

jest.mock('../main/preferences', () => ({ loadPreferences: jest.fn() }));
jest.mock('../main/capture-coordinator', () => ({
  startRecapture: jest.fn(async () => true),
}));

const mockedLoad = loadPreferences as jest.Mock;

describe('recaptureLastSelection', () => {
  afterEach(() => jest.clearAllMocks());

  it('re-captures the saved area on the display it was taken from', async () => {
    mockedLoad.mockResolvedValue({
      capture: {
        lastSelection: {
          x: -1800,
          y: 100,
          width: 400,
          height: 300,
          displayId: 7,
        },
      },
    });

    await expect(recaptureLastSelection()).resolves.toBe(true);
    expect(startRecapture).toHaveBeenCalledWith({
      x: -1800,
      y: 100,
      width: 400,
      height: 300,
      displayId: 7,
    });
  });

  it('does nothing before the first capture', async () => {
    mockedLoad.mockResolvedValue({ capture: { lastSelection: null } });
    await expect(recaptureLastSelection()).resolves.toBe(false);
    expect(startRecapture).not.toHaveBeenCalled();
  });
});

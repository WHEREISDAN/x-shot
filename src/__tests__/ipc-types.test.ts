import {
  isScreenshotSelection,
  isScreenshotScreenRequest,
  isScreenshotWindowRequest,
  sanitizeCaptureType,
} from '../shared/ipc-types';

describe('shared/ipc-types validators', () => {
  it('validates ScreenshotSelection', () => {
    expect(isScreenshotSelection({ x: 1, y: 2, width: 100, height: 200 })).toBe(
      true,
    );
    expect(isScreenshotSelection({})).toBe(false);
    expect(isScreenshotSelection({ x: 0, y: 0, width: 'a', height: 1 })).toBe(
      false,
    );
  });

  it('validates ScreenshotWindowRequest', () => {
    expect(isScreenshotWindowRequest({ sourceId: 'abc' })).toBe(true);
    expect(isScreenshotWindowRequest({ sourceId: '' })).toBe(false);
    expect(isScreenshotWindowRequest({})).toBe(false);
  });

  it('validates ScreenshotScreenRequest', () => {
    expect(isScreenshotScreenRequest({})).toBe(true);
    expect(isScreenshotScreenRequest({ sourceId: 'id' })).toBe(true);
    expect(isScreenshotScreenRequest({ displayId: '1' })).toBe(true);
    expect(isScreenshotScreenRequest({ displayId: 1 })).toBe(true);
    expect(
      isScreenshotScreenRequest({ sourceId: 123 as unknown as string }),
    ).toBe(false);
  });

  it('sanitizes capture type', () => {
    expect(sanitizeCaptureType(undefined)).toBe('window');
    expect(sanitizeCaptureType({})).toBe('window');
    expect(sanitizeCaptureType({ type: 'screen' })).toBe('screen');
  });
});

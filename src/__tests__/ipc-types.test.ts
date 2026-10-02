import {
  hasCapturedImage,
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

  it('accepts only captures that carry real pixels', () => {
    const capture = {
      imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
      width: 10,
      height: 10,
      sessionId: 'session-1',
    };
    expect(hasCapturedImage(capture)).toBe(true);
    // NativeImage.toDataURL() of an empty image.
    expect(
      hasCapturedImage({ ...capture, imageDataUrl: 'data:image/png;base64,' }),
    ).toBe(false);
    expect(hasCapturedImage({ ...capture, imageDataUrl: '' })).toBe(false);
    expect(hasCapturedImage({ ...capture, width: 0 })).toBe(false);
    expect(hasCapturedImage({ ...capture, height: -160 })).toBe(false);
  });
});

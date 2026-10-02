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
    // Empty selections are well formed; the capture reports them as failed.
    expect(
      isScreenshotSelection({ x: 5, y: 5, width: 0, height: 0, displayId: 2 }),
    ).toBe(true);
    expect(isScreenshotSelection({ x: 5, y: 5, width: -1, height: 10 })).toBe(
      false,
    );
    expect(
      isScreenshotSelection({
        x: 5,
        y: 5,
        width: 1,
        height: 1,
        displayId: 'a',
      }),
    ).toBe(false);
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

  it('accepts only captures that name a stored image with a real size', () => {
    const capture = {
      assetId: '0b7c2d4e-1f3a-4b5c-8d6e-7f8091a2b3c4',
      width: 10,
      height: 10,
      scaleFactor: 2,
      sessionId: 'session-1',
    };
    expect(hasCapturedImage(capture)).toBe(true);
    expect(hasCapturedImage({ ...capture, assetId: '' })).toBe(false);
    expect(
      hasCapturedImage({ ...capture, assetId: 'data:image/png;base64,AAAA' }),
    ).toBe(false);
    expect(hasCapturedImage({ ...capture, assetId: '../../etc/passwd' })).toBe(
      false,
    );
    expect(hasCapturedImage({ ...capture, width: 0 })).toBe(false);
    expect(hasCapturedImage({ ...capture, height: -160 })).toBe(false);
    expect(hasCapturedImage({ ...capture, scaleFactor: 0 })).toBe(false);
  });
});

/**
 * @jest-environment node
 */
import {
  CaptureSourceUnavailableError,
  toCaptureFailure,
  toCaptureSuccess,
} from '../main/capture-result';

describe('toCaptureFailure', () => {
  it('reports denied screen capture as a permission problem', () => {
    // desktopCapturer.getSources() rejects with this message when macOS
    // Screen Recording permission is missing.
    const error = new Error('Failed to get sources.');

    const mac = toCaptureFailure('session-3', error, 'darwin');
    expect(mac).toEqual({
      ok: false,
      sessionId: 'session-3',
      reason: 'screen-permission',
      message: expect.stringContaining('Screen Recording'),
    });

    const linux = toCaptureFailure('session-3', error, 'linux');
    expect(linux.reason).toBe('screen-permission');
    expect(linux.message).not.toContain('System Settings');
  });

  it('reports a vanished window or screen as unavailable', () => {
    const failure = toCaptureFailure(
      'session-4',
      new CaptureSourceUnavailableError('Window source not found'),
    );
    expect(failure.reason).toBe('source-unavailable');
    expect(failure.sessionId).toBe('session-4');
  });

  it('includes the error detail for any other failure', () => {
    const failure = toCaptureFailure('session-5', new Error('GPU lost'));
    expect(failure.reason).toBe('capture-error');
    expect(failure.message).toContain('GPU lost');

    expect(toCaptureFailure('session-6', 'plain string').message).toContain(
      'plain string',
    );
  });
});

describe('toCaptureSuccess', () => {
  const screenshot = {
    imageDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
    width: 640,
    height: 480,
    sessionId: 'session-7',
  };

  it('wraps a capture that has pixels', () => {
    expect(toCaptureSuccess(screenshot)).toEqual({ ok: true, screenshot });
  });

  it('refuses an empty capture so it travels the failure path instead', () => {
    expect(() =>
      toCaptureSuccess({
        ...screenshot,
        imageDataUrl: 'data:image/png;base64,',
      }),
    ).toThrow('The captured image is empty.');
    expect(() => toCaptureSuccess({ ...screenshot, width: -160 })).toThrow();
  });
});

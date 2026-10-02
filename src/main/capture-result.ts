import type {
  CaptureFailure,
  CaptureSuccess,
  ScreenshotResult,
} from '../shared/ipc-types';
import { hasCapturedImage } from '../shared/ipc-types';

// desktopCapturer rejects with this when the OS denies screen capture
// (macOS Screen Recording permission, or a refused Linux portal request).
const SOURCES_DENIED_ERROR = 'Failed to get sources';

type Platform = typeof process.platform;

export class CaptureSourceUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureSourceUnavailableError';
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function screenPermissionMessage(platform: Platform): string {
  if (platform === 'darwin') {
    return 'X-Shot needs Screen Recording permission. Turn it on in System Settings > Privacy & Security > Screen Recording, then quit and reopen X-Shot.';
  }
  return 'The screen could not be captured. Check that screen capture is allowed for X-Shot, then try again.';
}

export function toCaptureFailure(
  sessionId: string,
  error: unknown,
  platform: Platform = process.platform,
): CaptureFailure {
  const detail = errorMessage(error);
  if (detail.includes(SOURCES_DENIED_ERROR)) {
    return {
      ok: false,
      sessionId,
      reason: 'screen-permission',
      message: screenPermissionMessage(platform),
    };
  }
  if (error instanceof CaptureSourceUnavailableError) {
    return {
      ok: false,
      sessionId,
      reason: 'source-unavailable',
      message:
        'The window or screen you picked is no longer available. Try the capture again.',
    };
  }
  return {
    ok: false,
    sessionId,
    reason: 'capture-error',
    message: `The capture failed: ${detail}`,
  };
}

/** Wraps a capture for delivery; refuses captures without real pixels. */
export function toCaptureSuccess(screenshot: ScreenshotResult): CaptureSuccess {
  if (!hasCapturedImage(screenshot)) {
    throw new Error('The captured image is empty.');
  }
  return { ok: true, screenshot };
}

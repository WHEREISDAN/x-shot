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

export type CaptureErrorKind =
  | 'source-unavailable'
  | 'screen-permission'
  | 'empty-selection';

/** A capture failure main understands well enough to explain to the user. */
export class CaptureError extends Error {
  readonly kind: CaptureErrorKind;

  constructor(kind: CaptureErrorKind, message: string) {
    super(message);
    this.name = 'CaptureError';
    this.kind = kind;
  }
}

const isCaptureError = (error: unknown, kind: CaptureErrorKind) =>
  error instanceof CaptureError && error.kind === kind;

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
  if (
    isCaptureError(error, 'screen-permission') ||
    detail.includes(SOURCES_DENIED_ERROR)
  ) {
    return {
      ok: false,
      sessionId,
      reason: 'screen-permission',
      message: screenPermissionMessage(platform),
      ...(platform === 'darwin'
        ? { action: 'open-screen-recording-settings' as const }
        : {}),
    };
  }
  if (isCaptureError(error, 'empty-selection')) {
    return {
      ok: false,
      sessionId,
      reason: 'empty-selection',
      message:
        'Nothing was captured because the selected area is empty. Drag to select an area, then capture again.',
    };
  }
  if (isCaptureError(error, 'source-unavailable')) {
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

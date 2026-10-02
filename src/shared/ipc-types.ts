// Shared IPC types used across main, preload, and renderer
import { isCaptureAssetId, type CaptureAssetRef } from './capture-asset';
import type {
  AppPreferences,
  GetPreferencesRequest,
  ImportBackgroundRequest,
  ImportBackgroundResponse,
  SetPreferencesRequest,
  SetPreferencesResponse,
} from './preferences-types';

export type CaptureSourceType = 'window' | 'screen';

// Centralized logging types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMessage {
  level: LogLevel;
  message: string;
  scope?: string;
  meta?: Record<string, unknown> | unknown;
}

export * from './preferences-types';

export interface ListCaptureSourcesRequest {
  type?: CaptureSourceType;
}

/** A capturable source; images are ids in main's asset store. */
export interface BaseSourceItem {
  id: string;
  name: string;
  appIconAssetId: string | null;
  thumbnailAssetId: string | null;
}

export interface WindowSourceItem extends BaseSourceItem {}

export interface ScreenSourceItem extends BaseSourceItem {
  displayId?: string | null;
}

export type ListCaptureSourcesResponse = Array<
  WindowSourceItem | ScreenSourceItem
>;

export interface ScreenshotSelection {
  x: number;
  y: number;
  width: number;
  height: number;
  /** The display whose overlay the selection was drawn on. */
  displayId?: number;
}

/** A delivered capture; its pixels stay in main under `assetId`. */
export interface ScreenshotResult extends CaptureAssetRef {
  x?: number;
  y?: number;
  sourceId?: string;
  displayId?: string | number | null;
  windowTitle?: string;
  isWindowCapture?: boolean;
  isDisplayCapture?: boolean;
  /** Capture session id; the editor resets whenever it changes. */
  sessionId: string;
}

export type CaptureFailureReason =
  | 'screen-permission'
  | 'source-unavailable'
  | 'empty-selection'
  | 'window-size-unknown'
  | 'capture-error';

export interface CaptureSuccess {
  ok: true;
  screenshot: ScreenshotResult;
}

/** Something the editor can offer next to a failure message. */
export type CaptureFailureAction = 'open-screen-recording-settings';

export interface CaptureFailure {
  ok: false;
  sessionId: string;
  reason: CaptureFailureReason;
  /** User-facing explanation shown in the editor. */
  message: string;
  action?: CaptureFailureAction;
}

export type CaptureResult = CaptureSuccess | CaptureFailure;

export interface ScreenshotWindowRequest {
  sourceId: string;
}

export interface ScreenshotScreenRequest {
  sourceId?: string;
  displayId?: string | number;
}

/** PNG bytes; images never cross IPC as data URLs. */
export interface CopyImageRequest {
  png: Uint8Array;
}

export interface SaveImageRequest {
  png: Uint8Array;
  defaultPath?: string;
}

export type CopyImageResponse = { ok: true } | { ok: false; error: string };

export type SaveImageResponse =
  | { status: 'saved'; filePath: string }
  | { status: 'canceled' }
  | { status: 'failed'; error: string };

// Display snapshot for pre-capture overlay backgrounds
export interface GetDisplaySnapshotRequest {
  displayId: string | number;
}

export interface GetDisplaySnapshotResponse {
  /** The snapshot in main's asset store; see capture-asset.ts. */
  assetId: string;
  width: number;
  height: number;
}

// Window controls and state for custom title bar
export type WindowControlAction =
  | 'minimize'
  | 'maximize'
  | 'unmaximize'
  | 'close'
  | 'toggle-maximize';

export interface WindowState {
  isMaximized: boolean;
  isFullScreen: boolean;
  isFocused: boolean;
  platform: 'darwin' | 'win32' | 'linux';
}

/** Main asks a window to save its pending preference changes now. */
export interface FlushPreferencesRequest {
  requestId: string;
}

// IPC channel maps
export type RendererToMainPayloads = {
  'screenshot-capture': void;
  'screenshot-cancel': void;
  'screenshot-window': ScreenshotWindowRequest;
  'screenshot-screen': ScreenshotScreenRequest;
  'screenshot-data': ScreenshotSelection;
  log: LogMessage;
  /** The window saved everything a 'flush-preferences' request asked for. */
  'preferences-flushed': FlushPreferencesRequest;
};

export type MainToRendererEvents = {
  'capture-result': CaptureResult;
  'window-state': WindowState;
  'flush-preferences': FlushPreferencesRequest;
};

export interface IpcInvokes {
  'list-capture-sources': {
    req: ListCaptureSourcesRequest | undefined;
    res: ListCaptureSourcesResponse;
  };
  'get-display-snapshot': {
    req: GetDisplaySnapshotRequest;
    res: GetDisplaySnapshotResponse | null;
  };
  'release-capture-asset': {
    req: { assetId: string };
    res: boolean;
  };
  'copy-image': {
    req: CopyImageRequest;
    res: CopyImageResponse;
  };
  'save-image': {
    req: SaveImageRequest;
    res: SaveImageResponse;
  };
  'window-control': {
    req: { action: WindowControlAction };
    res: boolean;
  };
  'get-window-state': {
    req: undefined;
    res: WindowState;
  };
  'get-preferences': {
    req: GetPreferencesRequest;
    res: AppPreferences;
  };
  'set-preferences': {
    req: SetPreferencesRequest;
    res: SetPreferencesResponse;
  };
  'import-background-image': {
    req: ImportBackgroundRequest;
    res: ImportBackgroundResponse;
  };
  'open-preferences-window': {
    req: undefined;
    res: boolean;
  };
  'reset-preferences': {
    req: undefined;
    res: AppPreferences;
  };
  'open-screen-recording-settings': {
    req: undefined;
    res: boolean;
  };
  'select-folder': {
    req: { defaultPath?: string };
    res: { filePath: string | null; canceled: boolean };
  };
}

// Runtime validators (shared so they can be unit-tested without electron)
/**
 * A well-formed selection. An empty (zero-size) one is still well formed:
 * the capture reports it as a failure instead of silently ignoring it.
 */
export function isScreenshotSelection(
  value: unknown,
): value is ScreenshotSelection {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const finite = (n: unknown) => typeof n === 'number' && Number.isFinite(n);
  return (
    finite(v.x) &&
    finite(v.y) &&
    finite(v.width) &&
    (v.width as number) >= 0 &&
    finite(v.height) &&
    (v.height as number) >= 0 &&
    (v.displayId === undefined || finite(v.displayId))
  );
}

export function isScreenshotWindowRequest(
  value: unknown,
): value is ScreenshotWindowRequest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.sourceId === 'string' && v.sourceId.length > 0;
}

export function isScreenshotScreenRequest(
  value: unknown,
): value is ScreenshotScreenRequest {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const hasSourceId =
    v.sourceId === undefined || typeof v.sourceId === 'string';
  const hasDisplayId =
    v.displayId === undefined ||
    typeof v.displayId === 'string' ||
    typeof v.displayId === 'number';
  return hasSourceId && hasDisplayId;
}

/** True when a capture names a stored image with a real size. */
export function hasCapturedImage(screenshot: ScreenshotResult): boolean {
  const positive = (n: number) => Number.isFinite(n) && n > 0;
  return (
    isCaptureAssetId(screenshot.assetId) &&
    positive(screenshot.width) &&
    positive(screenshot.height) &&
    positive(screenshot.scaleFactor)
  );
}

export function sanitizeCaptureType(
  request: ListCaptureSourcesRequest | undefined,
): CaptureSourceType {
  return request?.type === 'screen' ? 'screen' : 'window';
}

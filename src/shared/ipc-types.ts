// Shared IPC types used across main, preload, and renderer

export type CaptureSourceType = 'window' | 'screen';

// Centralized logging types
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogMessage {
  level: LogLevel;
  message: string;
  scope?: string;
  meta?: Record<string, unknown> | unknown;
}

// Preferences System Types
export interface CapturePreferences {
  hotkey: string;
  // Optional delayed capture hotkeys (Electron accelerator strings)
  hotkeyDelay3?: string | null;
  hotkeyDelay5?: string | null;
  // Optional re-capture last area hotkey
  hotkeyRecapture?: string | null;
  defaultSaveLocation: string;
  autoCopyToClipboard: boolean;
  defaultFormat: 'png' | 'jpg';
  // Last used area selection for quick re-capture
  lastSelection?: {
    x: number;
    y: number;
    width: number;
    height: number;
    displayId: number;
  } | null;
}

export interface EditorPreferences {
  defaultStrokeColor: string;
  defaultFillColor: string;
  defaultStrokeWidth: number;
  defaultTextSize: number;
}

export interface ExportPreferences {
  filenamePattern: string;
  autoSave: boolean;
  defaultScale: number;
}

export interface SystemPreferences {
  launchAtStartup: boolean;
  showInTray: boolean;
}

export interface PiiDetectors {
  email: boolean;
  phone: boolean;
  address: boolean;
  ipv4: boolean;
  url: boolean;
  ssn: boolean;
  creditCard: boolean;
  dob: boolean;
  postalUS: boolean;
  postalCA: boolean;
  postalUK: boolean;
  uuid: boolean;
  mac: boolean;
  iban: boolean;
  poBox: boolean;
  tokens: boolean;
}

export interface PiiPreferences {
  autoDetect: boolean;
  defaultStyle: 'blur' | 'black';
  detectors: PiiDetectors;
}

// Import presentation types (will be migrated from use-presentation-state.ts)
export interface PresentationSettings {
  gradient: {
    kind: 'linear' | 'radial';
    angleDeg: number;
    stops: Array<{ offset: number; color: string }>;
  };
  // Optional background image; when set, overrides gradient background
  backgroundImageUrl?: string | null;
  padding: number;
  inset: number;
  radius: number;
  shadow: {
    enabled: boolean;
    x: number;
    y: number;
    blur: number;
    spread: number;
    color: string;
  };
  aspect: {
    preset: 'auto' | '1:1' | '4:3' | '3:2' | '16:9' | '9:16' | 'custom';
    custom?: { w: number; h: number };
  };
  exportScale: number;
  borderColor: string;
}

export interface AppPreferences {
  capture: CapturePreferences;
  editor: EditorPreferences;
  export: ExportPreferences;
  system: SystemPreferences;
  pii: PiiPreferences;
  presentation: PresentationSettings;
}

export interface GetPreferencesRequest {
  // Empty for now, could add specific keys later
}

export interface SetPreferencesRequest {
  preferences: Partial<AppPreferences>;
}

export interface ListCaptureSourcesRequest {
  type?: CaptureSourceType;
}

export interface BaseSourceItem {
  id: string;
  name: string;
  appIcon: string | null;
  thumbnail: string | null;
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

export interface ScreenshotResult {
  imageDataUrl: string;
  width: number;
  height: number;
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

export interface CopyImageRequest {
  dataUrl: string;
}

export interface SaveImageRequest {
  dataUrl: string;
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
  dataUrl: string;
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

// IPC channel maps
export type RendererToMainPayloads = {
  'ipc-example': string[];
  'screenshot-capture': void;
  'screenshot-cancel': void;
  'screenshot-window': ScreenshotWindowRequest;
  'screenshot-screen': ScreenshotScreenRequest;
  'screenshot-data': ScreenshotSelection;
  log: LogMessage;
};

export type MainToRendererEvents = {
  'ipc-example': string;
  'capture-result': CaptureResult;
  'window-state': WindowState;
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
  'release-display-snapshots': {
    req: undefined;
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
    res: boolean;
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

/** True when a capture carries real pixels, not an empty data URL. */
export function hasCapturedImage(screenshot: ScreenshotResult): boolean {
  const commaAt = screenshot.imageDataUrl.indexOf(',');
  return (
    screenshot.imageDataUrl.startsWith('data:image/') &&
    commaAt >= 0 &&
    commaAt < screenshot.imageDataUrl.length - 1 &&
    Number.isFinite(screenshot.width) &&
    screenshot.width > 0 &&
    Number.isFinite(screenshot.height) &&
    screenshot.height > 0
  );
}

export function sanitizeCaptureType(
  request: ListCaptureSourcesRequest | undefined,
): CaptureSourceType {
  return request?.type === 'screen' ? 'screen' : 'window';
}

// Shared IPC types used across main, preload, and renderer

export type CaptureSourceType = 'window' | 'screen';

// Preferences System Types
export interface CapturePreferences {
  hotkey: string;
  defaultSaveLocation: string;
  autoCopyToClipboard: boolean;
  defaultFormat: 'png' | 'jpg';
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

export interface PiiPreferences {
  autoDetect: boolean;
  defaultStyle: 'blur' | 'black';
}

// Import presentation types (will be migrated from use-presentation-state.ts)
export interface PresentationSettings {
  gradient: {
    kind: 'linear' | 'radial';
    angleDeg: number;
    stops: Array<{ offset: number; color: string }>;
  };
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
}

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

export interface SaveImageResponse {
  filePath: string | null;
  canceled: boolean;
}

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
};

export type MainToRendererEvents = {
  'ipc-example': string;
  'screenshot-data': ScreenshotResult;
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
    res: boolean;
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
  'select-folder': {
    req: { defaultPath?: string };
    res: { filePath: string | null; canceled: boolean };
  };
}

// Runtime validators (shared so they can be unit-tested without electron)
export function isScreenshotSelection(
  value: unknown,
): value is ScreenshotSelection {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.width === 'number' &&
    typeof v.height === 'number'
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

export function sanitizeCaptureType(
  request: ListCaptureSourcesRequest | undefined,
): CaptureSourceType {
  return request?.type === 'screen' ? 'screen' : 'window';
}

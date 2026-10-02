// Preferences shared by main, preload and renderer.

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
  /** The export scale every new capture starts with. */
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

/**
 * A presentation background image: one bundled with the app, named by its
 * bundle file, or one the user added, stored under userData/backgrounds.
 */
export type BackgroundImageRef =
  | { kind: 'builtin'; file: string }
  | { kind: 'file'; id: string };

export interface PresentationPreferences {
  gradient: {
    kind: 'linear' | 'radial';
    angleDeg: number;
    stops: Array<{ offset: number; color: string }>;
  };
  /** When set, shown instead of the gradient. */
  backgroundImage: BackgroundImageRef | null;
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
  borderColor: string;
}

export interface AppPreferences {
  capture: CapturePreferences;
  editor: EditorPreferences;
  export: ExportPreferences;
  system: SystemPreferences;
  pii: PiiPreferences;
  presentation: PresentationPreferences;
}

/** A partial update; main merges it into the stored preferences deeply. */
export interface PreferencesUpdate {
  capture?: Partial<CapturePreferences>;
  editor?: Partial<EditorPreferences>;
  export?: Partial<ExportPreferences>;
  system?: Partial<SystemPreferences>;
  pii?: Partial<Omit<PiiPreferences, 'detectors'>> & {
    detectors?: Partial<PiiDetectors>;
  };
  presentation?: Partial<PresentationPreferences>;
}

export interface GetPreferencesRequest {
  // Empty for now, could add specific keys later
}

export interface SetPreferencesRequest {
  preferences: PreferencesUpdate;
}

export type SetPreferencesResponse =
  | { ok: true; preferences: AppPreferences }
  | { ok: false; error: string };

/** An image file the user picked, as bytes. */
export interface ImportBackgroundRequest {
  bytes: Uint8Array;
}

export type ImportBackgroundResponse =
  | { ok: true; image: BackgroundImageRef }
  | { ok: false; error: string };

import type { PiiDetectors } from '../../../shared/ipc-types';
import type { RectShape } from '../use-editor-state';
import type {
  OcrLine,
  OcrParagraph,
  OcrStatus,
  OcrWord,
} from '../use-text-detection';

export interface MaskBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A detected PII region, as returned by computePiiMasks. */
export interface PiiMaskRect extends MaskBox {
  tag: string; // 'pii-email' | 'pii-phone' | ...
}

export type PiiStyle = 'blur' | 'black';

export type PiiMaskSource = 'auto' | 'manual';

export interface PiiMask {
  id: string;
  source: PiiMaskSource;
  tag: string;
  rect: MaskBox;
}

/**
 * 'pending' until preferences load and, with Censor PII on, until OCR for
 * the current image finishes. 'ocr-failed' means only manual masks exist.
 */
export type PiiLayerStatus = 'pending' | 'ready' | 'ocr-failed';

export interface PiiPreferencesState {
  censorPII: boolean;
  setCensorPII: (enabled: boolean) => void;
  defaultStyle: PiiStyle;
  detectors: PiiDetectors | null;
  /** Censor PII reads as off until loaded; callers must not act on it before. */
  loaded: boolean;
}

export interface UsePiiMaskingParams {
  screenshot: { imageDataUrl: string; width: number; height: number };
  preferences: PiiPreferencesState;
  ocr: {
    status: OcrStatus;
    words: OcrWord[];
    lines: OcrLine[];
    /** The image the OCR results belong to. */
    resultFor: string | null;
  };
}

export interface UsePiiMaskingResult {
  censorPII: boolean;
  setCensorPII: (next: boolean) => void;
  defaultStyle: PiiStyle;
  preferencesLoaded: boolean;
  status: PiiLayerStatus;
  /** Visible masks: auto masks with the user's changes, then manual masks. */
  masks: PiiMask[];
  /** The visible masks as rect shapes for rendering and hit testing. */
  maskShapes: RectShape[];
  selectedMaskId: string | null;
  selectMask: (id: string | null) => void;
  hitTestMask: (x: number, y: number) => string | null;
  addManualMask: (box: MaskBox) => string | null;
  updateMask: (id: string, box: MaskBox) => void;
  moveMask: (id: string, dx: number, dy: number) => void;
  deleteMask: (id: string) => void;
}

export type { PiiDetectors, OcrLine, OcrParagraph, OcrStatus, OcrWord };

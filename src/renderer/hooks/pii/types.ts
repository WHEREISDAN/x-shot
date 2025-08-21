import type { PiiDetectors } from '../../../shared/ipc-types';
import type { RectShape, EditorShape } from '../use-editor-state';
import type {
  OcrLine,
  OcrParagraph,
  OcrStatus,
  OcrWord,
} from '../use-text-detection';

export interface PiiMaskRect {
  x: number;
  y: number;
  width: number;
  height: number;
  tag: string; // 'pii-email' | 'pii-phone' | ... | 'pii-manual'
}

export interface UsePiiMaskingParams {
  screenshot: { imageDataUrl: string; width: number; height: number };
  ocr: {
    status: OcrStatus;
    words: OcrWord[];
    lines: OcrLine[];
    paragraphs: OcrParagraph[];
  };
  createRectForBox: (
    box: { x: number; y: number; width: number; height: number },
    options: {
      fillColor: string;
      strokeColor?: string;
      strokeWidth?: number;
      opacity?: number;
      radius?: number;
      tag?: string;
    },
  ) => RectShape;
  editorApi: {
    shapes: EditorShape[];
    addShapes: (newShapes: EditorShape[]) => string[];
    deleteShapesByIds: (ids: string[]) => void;
    getShapeById: (id: string) => EditorShape | undefined;
    getBoundsForShape: (shape: EditorShape) => {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  };
}

export interface UsePiiMaskingResult {
  censorPII: boolean;
  setCensorPII: (next: boolean) => void;
  defaultStyle: 'blur' | 'black';
  recordManualMaskOnCommit: (
    shape: EditorShape,
    bounds: { x: number; y: number; width: number; height: number },
  ) => void;
  updateMaskForShape: (
    shapeId: string,
    rect: { x: number; y: number; width: number; height: number },
  ) => void;
  syncDraggedMaskBounds: (shapeId: string) => void;
  deletePiiForShapeId: (shapeId: string) => void;
}

export type { PiiDetectors, OcrLine, OcrParagraph, OcrStatus, OcrWord };

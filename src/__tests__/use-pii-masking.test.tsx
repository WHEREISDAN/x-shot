import { act, renderHook } from '@testing-library/react';
import { usePiiMasking } from '../renderer/hooks/use-pii-masking';
import { useEditorState } from '../renderer/hooks/use-editor-state';
import type {
  OcrLine,
  OcrStatus,
  OcrWord,
  PiiDetectors,
  PiiPreferencesState,
  UsePiiMaskingParams,
} from '../renderer/hooks/pii/types';

const EMAIL_ONLY: PiiDetectors = {
  email: true,
  phone: false,
  address: false,
  ipv4: false,
  url: false,
  ssn: false,
  creditCard: false,
  dob: false,
  postalUS: false,
  postalCA: false,
  postalUK: false,
  uuid: false,
  mac: false,
  iban: false,
  poBox: false,
  tokens: false,
};

let preferences: PiiPreferencesState = {
  censorPII: true,
  setCensorPII: jest.fn(),
  defaultStyle: 'black',
  detectors: EMAIL_ONLY,
  loaded: true,
};

type LayerParams = Omit<UsePiiMaskingParams, 'preferences'>;

// Reads the current preferences on every render, like the editor does.
function useLayer(params: LayerParams) {
  return usePiiMasking({ ...params, preferences });
}

const IMAGE_A = {
  imageDataUrl: 'data:image/png;base64,QUFBQQ==',
  width: 1000,
  height: 420,
};
const IMAGE_B = {
  imageDataUrl: 'data:image/png;base64,QkJCQg==',
  width: 1000,
  height: 420,
};

function emailLine(label: string, email: string, x: number, y: number) {
  const labelWord: OcrWord = {
    text: label,
    bbox: { x, y, width: 80, height: 20 },
    confidence: 95,
  };
  const emailWord: OcrWord = {
    text: email,
    bbox: { x: x + 90, y, width: 200, height: 20 },
    confidence: 95,
  };
  const line: OcrLine = {
    text: `${label} ${email}`,
    bbox: { x, y, width: 290, height: 20 },
  };
  return { words: [labelWord, emailWord], lines: [line] };
}

const OCR_A = emailLine('Contact:', 'jane@example.com', 10, 20);
const OCR_B = emailLine('Mail', 'bob@sample.org', 400, 300);

function ocrFor(
  result: { words: OcrWord[]; lines: OcrLine[] },
  resultFor: string | null,
  status: OcrStatus = 'done',
): UsePiiMaskingParams['ocr'] {
  return { status, resultFor, ...result };
}

const RUNNING: UsePiiMaskingParams['ocr'] = {
  status: 'running',
  resultFor: null,
  words: [],
  lines: [],
};

const maskRects = (masks: { tag: string; rect: { x: number; y: number } }[]) =>
  masks.map(({ tag, rect }) => `${tag}@${rect.x},${rect.y}`);

describe('usePiiMasking', () => {
  beforeEach(() => {
    preferences = {
      ...preferences,
      censorPII: true,
      loaded: true,
    };
  });

  it('masks only the current image when OCR results arrive out of order', () => {
    const { result, rerender } = renderHook(
      (params: LayerParams) => useLayer(params),
      {
        initialProps: {
          screenshot: IMAGE_A,
          ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl),
        },
      },
    );
    expect(maskRects(result.current.masks)).toEqual(['pii-email@100,20']);

    // Image B is shown while the hook still holds image A's OCR result.
    rerender({ screenshot: IMAGE_B, ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl) });
    expect(result.current.masks).toEqual([]);
    expect(result.current.status).toBe('pending');

    rerender({ screenshot: IMAGE_B, ocr: ocrFor(OCR_B, IMAGE_B.imageDataUrl) });
    expect(maskRects(result.current.masks)).toEqual(['pii-email@490,300']);
    expect(result.current.status).toBe('ready');
  });

  it('keeps auto masks when annotations are undone', () => {
    const { result } = renderHook(() => ({
      editor: useEditorState(),
      pii: useLayer({
        screenshot: IMAGE_A,
        ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl),
      }),
    }));
    expect(result.current.pii.masks).toHaveLength(1);

    act(() => {
      result.current.editor.addShape({
        id: 'ellipse-1',
        type: 'ellipse',
        cx: 50,
        cy: 50,
        rx: 10,
        ry: 10,
        strokeColor: '#ef4444',
        strokeWidth: 2,
      });
    });
    act(() => result.current.editor.undo());
    act(() => result.current.editor.undo());

    expect(result.current.editor.shapes).toEqual([]);
    expect(maskRects(result.current.pii.masks)).toEqual(['pii-email@100,20']);
  });

  it('merges a manual mask drawn while OCR runs with the auto masks', () => {
    const { result, rerender } = renderHook(
      (params: LayerParams) => useLayer(params),
      { initialProps: { screenshot: IMAGE_A, ocr: RUNNING } },
    );
    expect(result.current.status).toBe('pending');

    act(() => {
      result.current.addManualMask({ x: 650, y: 300, width: -50, height: 20 });
    });
    expect(maskRects(result.current.masks)).toEqual(['pii-manual@600,300']);

    rerender({ screenshot: IMAGE_A, ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl) });
    expect(maskRects(result.current.masks)).toEqual([
      'pii-email@100,20',
      'pii-manual@600,300',
    ]);
  });

  it('keeps a deleted auto mask deleted across recomputes and toggles', () => {
    const { result, rerender } = renderHook(
      (params: LayerParams) => useLayer(params),
      {
        initialProps: {
          screenshot: IMAGE_A,
          ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl),
        },
      },
    );
    const [autoMask] = result.current.masks;
    act(() => result.current.selectMask(autoMask.id));
    act(() => result.current.deleteMask(autoMask.id));
    expect(result.current.masks).toEqual([]);
    expect(result.current.selectedMaskId).toBeNull();

    // Same detection, new OCR result objects.
    rerender({
      screenshot: IMAGE_A,
      ocr: ocrFor(
        emailLine('Contact:', 'jane@example.com', 10, 20),
        IMAGE_A.imageDataUrl,
      ),
    });
    expect(result.current.masks).toEqual([]);

    preferences = { ...preferences, censorPII: false };
    rerender({ screenshot: IMAGE_A, ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl) });
    preferences = { ...preferences, censorPII: true };
    rerender({ screenshot: IMAGE_A, ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl) });
    expect(result.current.masks).toEqual([]);
  });

  it('moves and resizes auto and manual masks', () => {
    const { result } = renderHook(() =>
      useLayer({
        screenshot: IMAGE_A,
        ocr: ocrFor(OCR_A, IMAGE_A.imageDataUrl),
      }),
    );
    const [autoMask] = result.current.masks;
    act(() => result.current.moveMask(autoMask.id, 5, -3));
    act(() => result.current.moveMask(autoMask.id, 5, -3));
    expect(result.current.masks[0].rect).toEqual({
      x: 110,
      y: 14,
      width: 200,
      height: 20,
    });

    let manualId: string | null = null;
    act(() => {
      manualId = result.current.addManualMask({
        x: 10,
        y: 10,
        width: 30,
        height: 30,
      });
    });
    act(() =>
      result.current.updateMask(manualId as unknown as string, {
        x: 20,
        y: 20,
        width: 40,
        height: 10,
      }),
    );
    expect(maskRects(result.current.masks)).toEqual([
      'pii-email@110,14',
      'pii-manual@20,20',
    ]);
    expect(result.current.hitTestMask(30, 25)).toBe(manualId);
  });

  it('hides the layer while Censor PII is off and ignores tiny drags', () => {
    preferences = { ...preferences, censorPII: false };
    const { result } = renderHook(() =>
      useLayer({ screenshot: IMAGE_A, ocr: RUNNING }),
    );
    expect(result.current.status).toBe('ready');
    let id: string | null = 'unset';
    act(() => {
      id = result.current.addManualMask({ x: 5, y: 5, width: 1, height: 40 });
    });
    expect(id).toBeNull();
    expect(result.current.masks).toEqual([]);
  });

  it('reports pending until preferences load and ocr-failed on OCR errors', () => {
    preferences = { ...preferences, loaded: false };
    const { result, rerender } = renderHook(
      (params: LayerParams) => useLayer(params),
      { initialProps: { screenshot: IMAGE_A, ocr: RUNNING } },
    );
    expect(result.current.status).toBe('pending');

    preferences = { ...preferences, loaded: true };
    rerender({
      screenshot: IMAGE_A,
      ocr: { ...RUNNING, status: 'error' },
    });
    expect(result.current.status).toBe('ocr-failed');
  });
});

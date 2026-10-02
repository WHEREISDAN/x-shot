import { useCallback, useMemo, useRef, useState } from 'react';
import type {
  MaskBox,
  PiiLayerStatus,
  PiiMask,
  UsePiiMaskingParams,
  UsePiiMaskingResult,
} from './pii/types';
import computePiiMasks from './pii/compute-masks';
import { maskToShape, styleDetectedBox } from './pii/apply-masks';
import {
  MANUAL_MASK_TAG,
  applyOverrides,
  autoMaskId,
  findMaskAt,
  isDrawableMask,
  isManualMaskId,
  manualMaskId,
  normalizeBox,
  shiftBox,
  type AutoMaskOverride,
} from './pii/mask-layer';

function layerStatus(
  preferencesLoaded: boolean,
  censorPII: boolean,
  ocrDone: boolean,
  ocrFailed: boolean,
): PiiLayerStatus {
  if (!preferencesLoaded) return 'pending';
  if (!censorPII || ocrDone) return 'ready';
  if (ocrFailed) return 'ocr-failed';
  return 'pending';
}

/**
 * The PII mask layer for one capture. Auto masks are derived from the OCR
 * result of the current image; the user's changes to them and the masks they
 * draw are kept alongside. The layer lives outside the editor's undo stack.
 */
export function usePiiMasking({
  screenshot,
  ocr,
  preferences,
}: UsePiiMaskingParams): UsePiiMaskingResult {
  const { censorPII, setCensorPII, defaultStyle, detectors, loaded } =
    preferences;
  const [overrides, setOverrides] = useState<Record<string, AutoMaskOverride>>(
    {},
  );
  const [manualMasks, setManualMasks] = useState<PiiMask[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const manualSequenceRef = useRef(0);

  // OCR results only count for the image they were computed from.
  const ocrDone =
    ocr.status === 'done' && ocr.resultFor === screenshot.imageUrl;

  const autoMasks = useMemo<PiiMask[]>(() => {
    if (!ocrDone || !detectors) return [];
    const image = { width: screenshot.width, height: screenshot.height };
    return computePiiMasks(detectors, ocr.lines, ocr.words).map(
      (detection) => ({
        id: autoMaskId(detection),
        source: 'auto',
        tag: detection.tag,
        rect: styleDetectedBox(detection, defaultStyle, image),
      }),
    );
  }, [
    ocrDone,
    detectors,
    ocr.lines,
    ocr.words,
    defaultStyle,
    screenshot.width,
    screenshot.height,
  ]);

  const masks = useMemo(
    () =>
      censorPII
        ? [...applyOverrides(autoMasks, overrides), ...manualMasks]
        : [],
    [censorPII, autoMasks, overrides, manualMasks],
  );

  const maskShapes = useMemo(
    () => masks.map((mask) => maskToShape(mask, defaultStyle)),
    [masks, defaultStyle],
  );

  const selectedMaskId =
    selectedId && masks.some((mask) => mask.id === selectedId)
      ? selectedId
      : null;

  const hitTestMask = useCallback(
    (x: number, y: number) => findMaskAt(masks, x, y),
    [masks],
  );

  const addManualMask = useCallback((box: MaskBox): string | null => {
    if (!isDrawableMask(box)) return null;
    manualSequenceRef.current += 1;
    const id = manualMaskId(manualSequenceRef.current);
    setManualMasks((prev) => [
      ...prev,
      { id, source: 'manual', tag: MANUAL_MASK_TAG, rect: normalizeBox(box) },
    ]);
    return id;
  }, []);

  const updateMask = useCallback((id: string, box: MaskBox) => {
    const rect = normalizeBox(box);
    if (isManualMaskId(id)) {
      setManualMasks((prev) =>
        prev.map((mask) => (mask.id === id ? { ...mask, rect } : mask)),
      );
      return;
    }
    setOverrides((prev) => ({ ...prev, [id]: { rect } }));
  }, []);

  const moveMask = useCallback(
    (id: string, dx: number, dy: number) => {
      if (isManualMaskId(id)) {
        setManualMasks((prev) =>
          prev.map((mask) =>
            mask.id === id
              ? { ...mask, rect: shiftBox(mask.rect, dx, dy) }
              : mask,
          ),
        );
        return;
      }
      setOverrides((prev) => {
        const current = prev[id];
        const base =
          current && 'rect' in current
            ? current.rect
            : autoMasks.find((mask) => mask.id === id)?.rect;
        if (!base || (current && 'deleted' in current)) return prev;
        return { ...prev, [id]: { rect: shiftBox(base, dx, dy) } };
      });
    },
    [autoMasks],
  );

  const deleteMask = useCallback((id: string) => {
    if (isManualMaskId(id)) {
      setManualMasks((prev) => prev.filter((mask) => mask.id !== id));
    } else {
      setOverrides((prev) => ({ ...prev, [id]: { deleted: true } }));
    }
    setSelectedId((current) => (current === id ? null : current));
  }, []);

  return {
    censorPII,
    setCensorPII,
    defaultStyle,
    preferencesLoaded: loaded,
    status: layerStatus(loaded, censorPII, ocrDone, ocr.status === 'error'),
    masks,
    maskShapes,
    selectedMaskId,
    selectMask: setSelectedId,
    hitTestMask,
    addManualMask,
    updateMask,
    moveMask,
    deleteMask,
  };
}

export default usePiiMasking;

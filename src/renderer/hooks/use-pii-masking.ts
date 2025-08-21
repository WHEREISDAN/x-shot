import { useCallback, useEffect, useRef } from 'react';
import type { EditorShape } from './use-editor-state';
import type {
  UsePiiMaskingParams,
  UsePiiMaskingResult,
  PiiMaskRect,
} from './pii/types';
import usePiiPreferences from './pii/preferences';
import { usePersistedPiiMasks, usePiiStorageKey } from './pii/storage';
import computePiiMasks from './pii/compute-masks';
import applyMasksAsShapes from './pii/apply-masks';

export function usePiiMasking(
  params: UsePiiMaskingParams,
): UsePiiMaskingResult {
  const { screenshot, ocr, createRectForBox, editorApi } = params;
  const {
    shapes,
    addShapes,
    deleteShapesByIds,
    getShapeById,
    getBoundsForShape,
  } = editorApi;

  // Preferences (censor toggle, style, detectors)
  const { censorPII, setCensorPII, defaultStyle, detectors } =
    usePiiPreferences();

  // Persisted per-screenshot masks
  const piiStorageKey = usePiiStorageKey(screenshot);
  const { setPiiMasks, piiMasksRef } = usePersistedPiiMasks(piiStorageKey);

  // Map of editor shape id -> mask index within piiMasks
  const piiMaskIdsRef = useRef<Map<string, number>>(new Map());
  const autoCensorIdsRef = useRef<string[]>([]);
  const censorAppliedRef = useRef<boolean>(false);

  // Keep refs to editor actions to avoid stale closures
  const addShapesRef = useRef(addShapes);
  const deleteShapesByIdsRef = useRef(deleteShapesByIds);
  const shapesRef = useRef(shapes);
  useEffect(() => {
    addShapesRef.current = addShapes;
  }, [addShapes]);
  useEffect(() => {
    deleteShapesByIdsRef.current = deleteShapesByIds;
  }, [deleteShapesByIds]);
  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  // Helper for removing all existing PII-tagged shapes
  const removeAllTagged = useCallback(() => {
    const taggedIds = shapesRef.current
      .filter((s) => {
        const t = s.tag;
        return (
          t === 'pii-email' ||
          t === 'pii-phone' ||
          t === 'pii-address' ||
          t === 'pii-ipv4' ||
          t === 'pii-url' ||
          t === 'pii-ssn' ||
          t === 'pii-cc' ||
          t === 'pii-dob' ||
          t === 'pii-postal-us' ||
          t === 'pii-postal-ca' ||
          t === 'pii-postal-uk' ||
          t === 'pii-uuid' ||
          t === 'pii-mac' ||
          t === 'pii-iban' ||
          t === 'pii-po-box' ||
          t === 'pii-token' ||
          t === 'pii-manual'
        );
      })
      .map((s) => s.id);
    if (taggedIds.length > 0) deleteShapesByIdsRef.current(taggedIds);
    autoCensorIdsRef.current = [];
    piiMaskIdsRef.current.clear();
    censorAppliedRef.current = false;
  }, []);

  // Apply masks as editor shapes and build mapping
  const applyMasks = useCallback(
    (masks: PiiMaskRect[]) => {
      if (!masks || masks.length === 0) return;
      const shapesToAdd = applyMasksAsShapes(
        masks,
        defaultStyle,
        { width: screenshot.width, height: screenshot.height },
        createRectForBox,
      );
      const ids = addShapesRef.current(shapesToAdd);
      autoCensorIdsRef.current = ids;
      piiMaskIdsRef.current.clear();
      ids.forEach((id, idx) => piiMaskIdsRef.current.set(id, idx));
      censorAppliedRef.current = true;
    },
    [createRectForBox, defaultStyle, screenshot.width, screenshot.height],
  );

  // Compute masks from OCR and auto-apply when enabled
  const { status, words, lines } = ocr;
  useEffect(() => {
    if (!censorPII) {
      removeAllTagged();
      return;
    }
    // Only proceed when OCR done or persisted masks are available
    if (status !== 'done' && piiMasksRef.current.length === 0) return;
    if (censorAppliedRef.current) return;

    // Use existing masks for this screenshot if available
    if (piiMasksRef.current.length > 0) {
      applyMasks(piiMasksRef.current);
      return;
    }

    // Ensure detectors are loaded
    const enabled = detectors;
    if (!enabled) return;

    const masks = computePiiMasks(enabled, lines, words);
    setPiiMasks(masks);
    applyMasks(masks);
  }, [
    status,
    words,
    lines,
    censorPII,
    applyMasks,
    removeAllTagged,
    ocr.lines,
    detectors,
    setPiiMasks,
    piiMasksRef,
  ]);

  // Reset all PII state if screenshot changes
  useEffect(() => {
    censorAppliedRef.current = false;
    piiMasksRef.current = [];
    piiMaskIdsRef.current.clear();
    autoCensorIdsRef.current = [];
    setPiiMasks([]);
  }, [screenshot.imageDataUrl, setPiiMasks, piiMasksRef]);

  // Public helpers for editor interactions
  const recordManualMaskOnCommit = useCallback(
    (
      shape: EditorShape,
      bounds: { x: number; y: number; width: number; height: number },
    ) => {
      const { tag } = shape;
      if (!tag || !tag.startsWith('pii-')) return;
      const shapeId = shape.id;
      setPiiMasks((prev) => {
        const newIndex = prev.length;
        piiMaskIdsRef.current.set(shapeId, newIndex);
        return [
          ...prev,
          {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            tag,
          },
        ];
      });
    },
    [setPiiMasks],
  );

  const updateMaskForShape = useCallback(
    (
      shapeId: string,
      rect: { x: number; y: number; width: number; height: number },
    ) => {
      const maskIndex = piiMaskIdsRef.current.get(shapeId);
      if (maskIndex === undefined) return;
      setPiiMasks((prev) => {
        if (maskIndex < 0 || maskIndex >= prev.length) return prev;
        const next = prev.slice();
        next[maskIndex] = {
          ...next[maskIndex],
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
        return next;
      });
    },
    [setPiiMasks],
  );

  const syncDraggedMaskBounds = useCallback(
    (shapeId: string) => {
      const shape = getShapeById(shapeId);
      if (!shape) return;
      const { tag } = shape;
      if (!tag || !tag.startsWith('pii-')) return;
      const b = getBoundsForShape(shape);
      const idx = piiMaskIdsRef.current.get(shapeId);
      if (idx === undefined) return;
      setPiiMasks((prev) => {
        if (idx < 0 || idx >= prev.length) return prev;
        const next = prev.slice();
        next[idx] = {
          ...next[idx],
          x: b.x,
          y: b.y,
          width: b.width,
          height: b.height,
        };
        return next;
      });
    },
    [getShapeById, getBoundsForShape, setPiiMasks],
  );

  const deletePiiForShapeId = useCallback(
    (shapeId: string) => {
      const shape = getShapeById(shapeId);
      if (!shape) return;
      const { tag } = shape;
      if (!tag || !tag.startsWith('pii-')) return;
      const idx = piiMaskIdsRef.current.get(shapeId);
      if (idx === undefined) return;
      setPiiMasks((prev) => {
        if (idx < 0 || idx >= prev.length) return prev;
        const next = prev.slice();
        next.splice(idx, 1);
        return next;
      });
      piiMaskIdsRef.current.delete(shapeId);
      Array.from(piiMaskIdsRef.current.entries()).forEach(([key, value]) => {
        if (value > idx) piiMaskIdsRef.current.set(key, value - 1);
      });
    },
    [getShapeById, setPiiMasks],
  );

  return {
    censorPII,
    setCensorPII,
    defaultStyle,
    recordManualMaskOnCommit,
    updateMaskForShape,
    syncDraggedMaskBounds,
    deletePiiForShapeId,
  };
}

export default usePiiMasking;

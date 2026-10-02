import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  memo,
} from 'react';
import type { ScreenshotResult } from '../../../shared/ipc-types';
import {
  useEditorState,
  createNewShapeFromTool,
  EditorShape,
  PenShape,
  RectShape,
  EllipseShape,
  ArrowShape,
  TextShape,
} from '../../hooks/use-editor-state';
import TopBar from './TopBar';
import BottomToolbar from './BottomToolbar';
import SidePanel from './SidePanel';
import { getBoundsForShape, hitTestPoint } from './editor-geometry';
import { EditorStage } from './editor-stage';
import { usePresentationState } from '../../hooks/use-presentation-state';
import { computeLayout } from './compute-presentation-layout';
import { useEditorShortcuts } from '../../hooks/use-editor-shortcuts';
import { useExportGlue } from '../../hooks/use-export-glue';
import TextEditOverlay, { type TextEditState } from './TextEditOverlay';
import { useTextDetection } from '../../hooks/use-text-detection';
import { usePiiMasking } from '../../hooks/use-pii-masking';
import usePiiPreferences from '../../hooks/pii/preferences';
import { useAutoCopy } from '../../hooks/use-auto-copy';
import { MANUAL_MASK_TAG } from '../../hooks/pii/mask-layer';
import { piiShapeStyle } from '../../hooks/pii/apply-masks';
import {
  SelectionHandles,
  type ResizeHandle,
} from './editor-selection-overlay';

// What the select tool acts on: an annotation or a PII mask.
type SelectionTarget = { kind: 'shape' | 'mask'; id: string };

/**
 * Keeps pointer events on the stage until the button is released, so a drag
 * that ends over the side panel or outside the window still finishes.
 */
function captureStagePointer(target: Element, pointerId: number) {
  const stage =
    target instanceof SVGElement && target.ownerSVGElement
      ? target.ownerSVGElement
      : target;
  if (typeof stage.setPointerCapture === 'function') {
    stage.setPointerCapture(pointerId);
  }
}

interface ScreenshotEditorProps {
  screenshot: ScreenshotResult;
  onDelete: () => void;
  onCopy: (dataUrl: string) => Promise<boolean>;
  onSave: (dataUrl: string) => Promise<void>;
}

const ScreenshotEditor = memo(function ScreenshotEditor({
  screenshot,
  onDelete,
  onCopy,
  onSave,
}: ScreenshotEditorProps) {
  const state = useEditorState();
  const imgRef = useRef<HTMLImageElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const exportStageRef = useRef<HTMLDivElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [fitScale, setFitScale] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const viewScale = fitScale * zoom;

  const natural = useMemo(
    () => ({ width: screenshot.width, height: screenshot.height }),
    [screenshot.width, screenshot.height],
  );

  const [presentation, presActions] = usePresentationState();
  const layout = useMemo(
    () => computeLayout(natural.width, natural.height, presentation),
    [natural.width, natural.height, presentation],
  );
  const presentationDisabled =
    presentation.padding === 0 && presentation.inset === 0;
  const canvasW = presentationDisabled ? natural.width : layout.canvas.width;
  const canvasH = presentationDisabled ? natural.height : layout.canvas.height;
  const shotX = presentationDisabled ? 0 : layout.shot.x;
  const shotY = presentationDisabled ? 0 : layout.shot.y;
  const shotW = presentationDisabled ? natural.width : layout.shot.width;
  const shotH = presentationDisabled ? natural.height : layout.shot.height;

  const { exportDataUrl } = useExportGlue({
    stageRef: exportStageRef as React.RefObject<HTMLElement>,
    natural: { width: natural.width, height: natural.height },
    presentation,
    setIsExporting,
  });

  useEffect(() => {
    const updateFit = () => {
      const parent = containerRef.current;
      if (!parent) return;

      const horizontalMargin = 32;
      const maxWidth = Math.max(1, parent.clientWidth - horizontalMargin);

      const widthFit = maxWidth / canvasW;

      const next = Math.min(1.1, Math.max(0.05, widthFit));
      setFitScale(next);
    };
    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, [canvasW, canvasH, presentationDisabled]);

  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return { x: 0, y: 0 };
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const stageTopLeftX = centerX - (canvasW * viewScale) / 2 + pan.x;
      const stageTopLeftY = centerY - (canvasH * viewScale) / 2 + pan.y;
      const layoutX = (clientX - stageTopLeftX) / viewScale - shotX;
      const layoutY = (clientY - stageTopLeftY) / viewScale - shotY;

      const x = Math.max(
        0,
        Math.min(natural.width, (layoutX / Math.max(1, shotW)) * natural.width),
      );
      const y = Math.max(
        0,
        Math.min(
          natural.height,
          (layoutY / Math.max(1, shotH)) * natural.height,
        ),
      );
      return { x: Math.round(x), y: Math.round(y) };
    },
    [
      natural.width,
      natural.height,
      canvasW,
      canvasH,
      shotX,
      shotY,
      shotW,
      shotH,
      viewScale,
      pan.x,
      pan.y,
    ],
  );

  const [isPointerDown, setIsPointerDown] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragLastPos = useRef<{ x: number; y: number } | null>(null);
  const dragTargetRef = useRef<SelectionTarget | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle | null>(null);
  type ResizeStartData = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    target: SelectionTarget;
    handle: ResizeHandle;
  };
  const resizeStartRef = useRef<ResizeStartData | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState<TextEditState | null>(null);

  // Rectangle factory used by tools and PII masking
  const createRectForBox = useCallback(
    (
      box: { x: number; y: number; width: number; height: number },
      options: {
        fillColor: string;
        strokeColor?: string;
        strokeWidth?: number;
        opacity?: number;
        radius?: number;
        tag?: string;
      },
    ): RectShape => {
      const r = createNewShapeFromTool('rect', {
        x: box.x,
        y: box.y,
        strokeColor: options.strokeColor ?? 'transparent',
        fillColor: options.fillColor,
        strokeWidth: options.strokeWidth ?? 0,
      }) as RectShape;
      r.width = box.width;
      r.height = box.height;
      if (typeof options.opacity === 'number') r.opacity = options.opacity;
      if (typeof options.radius === 'number') r.radius = options.radius;
      if (options.tag) r.tag = options.tag;
      return r;
    },
    [],
  );
  const piiPreferences = usePiiPreferences();
  // OCR is only worth its cost for PII masking or the text-select tool.
  const ocrWanted =
    piiPreferences.censorPII || state.activeTool === 'text-select';
  const {
    status: ocrStatus,
    words,
    lines,
    paragraphs,
    resultFor,
  } = useTextDetection(screenshot.imageDataUrl, ocrWanted);
  const [textSelectLevel, setTextSelectLevel] = useState<
    'word' | 'line' | 'paragraph'
  >('word');
  const pii = usePiiMasking({
    screenshot,
    ocr: { status: ocrStatus, words, lines, resultFor },
    preferences: piiPreferences,
  });

  useAutoCopy({
    rawDataUrl: screenshot.imageDataUrl,
    censorPII: pii.censorPII,
    piiPreferencesLoaded: pii.preferencesLoaded,
    piiStatus: pii.status,
    exportRedacted: exportDataUrl,
    copy: onCopy,
  });

  const selectableItems = useMemo(() => {
    if (textSelectLevel === 'word') return words;
    if (textSelectLevel === 'line') return lines;
    return paragraphs;
  }, [textSelectLevel, words, lines, paragraphs]);

  const selectionTarget = useMemo<SelectionTarget | null>(() => {
    if (pii.selectedMaskId) return { kind: 'mask', id: pii.selectedMaskId };
    if (state.selectedShapeId) {
      return { kind: 'shape', id: state.selectedShapeId };
    }
    return null;
  }, [pii.selectedMaskId, state.selectedShapeId]);

  const deleteSelection = useCallback(() => {
    if (pii.selectedMaskId) {
      pii.deleteMask(pii.selectedMaskId);
      return;
    }
    state.deleteSelectedShape();
  }, [state, pii]);

  const clearSelection = useCallback(() => {
    state.selectShape(null);
    pii.selectMask(null);
  }, [state, pii]);

  // Empty text is removed, and canceling a new text removes it too.
  const finishTextEdit = useCallback(
    (edit: TextEditState, text: string | null) => {
      const removed = text === null ? edit.isNew : text.trim() === '';
      const current = state.getShapeById(edit.id) as TextShape | undefined;
      if (removed) state.deleteShapeById(edit.id);
      else if (text !== null && text !== current?.text) {
        state.updateTextShape(edit.id, text);
      }
      state.endGesture();
      setEditingText(null);
    },
    [state],
  );

  // Centralized keyboard shortcuts
  const { isSpacePressed } = useEditorShortcuts({
    editingActive: !!editingText,
    onCopy: async () => {
      const url = await exportDataUrl();
      await onCopy(url);
    },
    onSave: async () => {
      const url = await exportDataUrl();
      await onSave(url);
    },
    onUndo: state.undo,
    onRedo: state.redo,
    onDeleteSelected: deleteSelection,
    onEscape: clearSelection,
    setZoom: (updater) =>
      setZoom(typeof updater === 'number' ? updater : updater(zoom)),
    resetView: () => setZoom(1),
    setPan: (p) => setPan(p),
  });

  const hitTest = useCallback(
    (x: number, y: number): string | null => hitTestPoint(x, y, state.shapes),
    [state.shapes],
  );
  // Compute shape bounds in image coordinates
  const getBoundsForShapeMemo = useCallback(getBoundsForShape, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Text selection tool: click to add highlight over word/line/paragraph
      if (state.activeTool === 'text-select' && e.button === 0) {
        const { x, y } = toImageCoords(e.clientX, e.clientY);
        const contains = (b: {
          x: number;
          y: number;
          width: number;
          height: number;
        }) => x >= b.x && y >= b.y && x <= b.x + b.width && y <= b.y + b.height;
        const pool = selectableItems;
        const hit = pool.find((item) => contains(item.bbox));
        const box: {
          x: number;
          y: number;
          width: number;
          height: number;
        } | null = hit ? hit.bbox : null;
        if (box) {
          const highlight = createRectForBox(box, {
            fillColor: '#f59e0b',
            strokeColor: 'transparent',
            strokeWidth: 0,
            opacity: 0.35,
            radius: 2,
          });
          state.addShape(highlight);
        }
        return;
      }
      // Middle button or spacebar to pan
      if (e.button === 1 || isSpacePressed) {
        captureStagePointer(e.currentTarget, e.pointerId);
        setIsPanning(true);
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      // The right button opens the pan gesture via onContextMenu; it never
      // selects or draws.
      if (e.button !== 0) return;
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      captureStagePointer(e.currentTarget, e.pointerId);
      if (state.activeTool === 'select') {
        // Masks sit above annotations, so they win the hit test.
        const maskHit = pii.hitTestMask(x, y);
        const shapeHit = maskHit ? null : hitTest(x, y);
        pii.selectMask(maskHit);
        state.selectShape(shapeHit);
        let target: SelectionTarget | null = null;
        if (maskHit) target = { kind: 'mask', id: maskHit };
        else if (shapeHit) target = { kind: 'shape', id: shapeHit };
        if (target) {
          if (target.kind === 'shape') state.beginGesture();
          setIsDragging(true);
          dragLastPos.current = { x, y };
          dragTargetRef.current = target;
        } else {
          // Empty space: start panning with left button
          setIsPanning(true);
          panLast.current = { x: e.clientX, y: e.clientY };
        }
        return;
      }
      if (state.activeTool === 'text') {
        e.preventDefault();
        e.stopPropagation();
        const shape = createNewShapeFromTool('text', {
          x,
          y,
          strokeColor: state.strokeColor,
          strokeWidth: state.strokeWidth,
          textSize: state.textSize,
        }) as TextShape;
        // Placing and typing the text is one undo entry; an empty one is none.
        state.beginGesture();
        state.addShape(shape);
        state.selectShape(shape.id);
        // Defer opening the input until after the shape renders
        requestAnimationFrame(() => {
          setEditingText({ id: shape.id, value: '', isNew: true });
          state.setActiveTool('select');
        });
        return;
      }
      const shape = createNewShapeFromTool(state.activeTool, {
        x,
        y,
        strokeColor: state.strokeColor,
        fillColor: state.fillColor,
        strokeWidth: state.strokeWidth,
        textSize: state.textSize,
      });
      if (pii.censorPII && state.activeTool === 'rect') {
        // With Censor PII on, the rect tool draws a manual mask.
        Object.assign(shape as RectShape, piiShapeStyle(pii.defaultStyle), {
          strokeColor: 'transparent',
          tag: MANUAL_MASK_TAG,
        });
      }
      state.startProvisionalShape(shape);
      setIsPointerDown(true);
    },
    [
      state,
      toImageCoords,
      hitTest,
      isSpacePressed,
      selectableItems,
      createRectForBox,
      pii,
    ],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (isPanning && panLast.current) {
        const dx = e.clientX - panLast.current.x;
        const dy = e.clientY - panLast.current.y;
        panLast.current = { x: e.clientX, y: e.clientY };
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
        return;
      }
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      if (isResizing && resizeStartRef.current) {
        const start = resizeStartRef.current;
        let { left, top, right, bottom } = start;
        if (resizeHandle === 'nw') {
          left = x;
          top = y;
        } else if (resizeHandle === 'ne') {
          right = x;
          top = y;
        } else if (resizeHandle === 'sw') {
          left = x;
          bottom = y;
        } else if (resizeHandle === 'se') {
          right = x;
          bottom = y;
        }
        left = Math.max(0, Math.min(left, natural.width));
        top = Math.max(0, Math.min(top, natural.height));
        right = Math.max(0, Math.min(right, natural.width));
        bottom = Math.max(0, Math.min(bottom, natural.height));
        const nx = Math.min(left, right);
        const ny = Math.min(top, bottom);
        const nw = Math.max(1, Math.abs(right - left));
        const nh = Math.max(1, Math.abs(bottom - top));
        if (start.target.kind === 'mask') {
          pii.updateMask(start.target.id, {
            x: nx,
            y: ny,
            width: nw,
            height: nh,
          });
          return;
        }
        state.updateShape(start.target.id, (s) => {
          if (s.type !== 'rect') return s;
          const r = s as RectShape;
          return { ...r, x: nx, y: ny, width: nw, height: nh } as RectShape;
        });
        return;
      }
      if (isDragging && dragLastPos.current && dragTargetRef.current) {
        const dx = x - dragLastPos.current.x;
        const dy = y - dragLastPos.current.y;
        dragLastPos.current = { x, y };
        const target = dragTargetRef.current;
        if (target.kind === 'mask') pii.moveMask(target.id, dx, dy);
        else state.moveSelectedShapeBy(dx, dy);
        return;
      }
      if (!isPointerDown || !state.provisionalShape) return;
      state.updateProvisionalShape((s) => {
        switch (s.type) {
          case 'pen':
          case 'highlighter': {
            const p = s as PenShape;
            return { ...p, points: [...p.points, { x, y }] };
          }
          case 'rect': {
            const r = s as RectShape;
            return { ...r, width: x - r.x, height: y - r.y };
          }
          case 'ellipse': {
            const el = s as EllipseShape;
            return { ...el, rx: Math.abs(x - el.cx), ry: Math.abs(y - el.cy) };
          }
          case 'arrow': {
            const a = s as ArrowShape;
            return { ...a, x2: x, y2: y };
          }
          case 'text': {
            return s;
          }
          default:
            return s;
        }
      });
    },
    [
      isPointerDown,
      isDragging,
      state,
      toImageCoords,
      isPanning,
      isResizing,
      resizeHandle,
      natural.width,
      natural.height,
      pii,
    ],
  );

  const onPointerUp = useCallback(() => {
    if (isPanning) {
      setIsPanning(false);
      panLast.current = null;
      return;
    }
    if (isResizing) {
      setIsResizing(false);
      setResizeHandle(null);
      resizeStartRef.current = null;
      setIsPointerDown(false);
      state.endGesture();
      return;
    }
    if (isDragging) {
      setIsDragging(false);
      dragTargetRef.current = null;
      dragLastPos.current = null;
      state.endGesture();
      return;
    }
    if (!isPointerDown) return;
    setIsPointerDown(false);
    const provisional = state.provisionalShape as EditorShape | null;
    if (!provisional) return;
    if (provisional.tag !== MANUAL_MASK_TAG) {
      state.commitProvisionalShape();
      return;
    }
    // Manual masks join the PII layer, outside the annotation undo stack.
    state.cancelProvisionalShape();
    const maskId = pii.addManualMask(getBoundsForShapeMemo(provisional));
    state.selectShape(null);
    pii.selectMask(maskId);
  }, [
    isPointerDown,
    isDragging,
    isPanning,
    state,
    getBoundsForShapeMemo,
    isResizing,
    pii,
  ]);

  // Wheel: zoom with cmd/ctrl, otherwise pan
  const onWheel = useCallback(
    (e: React.WheelEvent) => {
      if (!containerRef.current) return;
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const bounds = containerRef.current.getBoundingClientRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const prevScale = viewScale;
        const nextZoom = Math.min(
          8,
          Math.max(0.25, zoom * 1.0015 ** -e.deltaY),
        );
        const nextScale = fitScale * nextZoom;
        // keep pointer stable
        const stageTopLeftPrevX = centerX - (canvasW * prevScale) / 2 + pan.x;
        const stageTopLeftPrevY = centerY - (canvasH * prevScale) / 2 + pan.y;
        const imgX = (e.clientX - stageTopLeftPrevX) / prevScale;
        const imgY = (e.clientY - stageTopLeftPrevY) / prevScale;
        const stageTopLeftNextX = e.clientX - imgX * nextScale;
        const stageTopLeftNextY = e.clientY - imgY * nextScale;
        const panX = stageTopLeftNextX - (centerX - (canvasW * nextScale) / 2);
        const panY = stageTopLeftNextY - (centerY - (canvasH * nextScale) / 2);
        setZoom(nextZoom);
        setPan({ x: panX, y: panY });
      } else {
        // Pan with wheel
        const factor = 0.5;
        setPan((p) => ({
          x: p.x - e.deltaX * factor,
          y: p.y - e.deltaY * factor,
        }));
      }
    },
    [fitScale, canvasW, canvasH, pan.x, pan.y, viewScale, zoom],
  );

  const handleCopy = useCallback(async () => {
    const url = await exportDataUrl();
    await onCopy(url);
  }, [exportDataUrl, onCopy]);

  const handleSave = useCallback(async () => {
    const url = await exportDataUrl();
    await onSave(url);
  }, [exportDataUrl, onSave]);

  return (
    <div
      data-session-id={screenshot.sessionId}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        background: '#0b0b0c',
      }}
    >
      <TopBar
        onDelete={onDelete}
        onCopy={handleCopy}
        onSave={handleSave}
        viewScalePercent={viewScale * 100}
        censorPII={pii.censorPII}
        setCensorPII={pii.setCensorPII}
      />

      {/* Stage */}
      <EditorStage
        natural={{ width: natural.width, height: natural.height }}
        presentationDisabled={presentationDisabled}
        layout={{
          frame: layout.frame,
          shot: layout.shot,
          canvas: layout.canvas,
        }}
        pan={pan}
        viewScale={viewScale}
        presentation={presentation}
        screenshotUrl={screenshot.imageDataUrl}
        containerRef={containerRef}
        imgRef={imgRef}
        exportStageRef={exportStageRef as React.RefObject<HTMLDivElement>}
        isExporting={isExporting}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={(e) => {
          const { x, y } = toImageCoords(e.clientX, e.clientY);
          const hit = hitTest(x, y);
          if (!hit) return;
          const shape = state.getShapeById(hit);
          if (shape && shape.type === 'text') {
            state.beginGesture();
            setEditingText({
              id: shape.id,
              value: (shape as TextShape).text,
              isNew: false,
            });
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Backspace' || e.key === 'Delete') && !editingText) {
            e.preventDefault();
            deleteSelection();
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsPanning(true);
          panLast.current = { x: e.clientX, y: e.clientY };
        }}
        shapes={state.shapes}
        piiMasks={pii.maskShapes}
        provisionalShape={state.provisionalShape as EditorShape | null}
        showOcrOverlay={
          state.activeTool === 'text-select' && ocrStatus === 'done'
        }
        ocrBoxes={selectableItems.map((it) => it.bbox)}
        ocrKeyPrefix={`ocr-${textSelectLevel}`}
        renderSelectionOverlay={() => {
          if (!selectionTarget) return null;
          const selected =
            selectionTarget.kind === 'mask'
              ? pii.maskShapes.find((m) => m.id === selectionTarget.id)
              : state.getShapeById(selectionTarget.id);
          if (!selected) return null;
          const b = getBoundsForShapeMemo(selected);
          return (
            <SelectionHandles
              bounds={b}
              strokeWidth={selected.strokeWidth}
              onResizeStart={(handle, event) => {
                captureStagePointer(event.currentTarget, event.pointerId);
                if (selectionTarget.kind === 'shape') state.beginGesture();
                setIsResizing(true);
                setResizeHandle(handle);
                resizeStartRef.current = {
                  left: b.x,
                  top: b.y,
                  right: b.x + b.width,
                  bottom: b.y + b.height,
                  target: selectionTarget,
                  handle,
                };
              }}
              onDelete={deleteSelection}
            />
          );
        }}
      />
      <SidePanel settings={presentation} onChange={presActions} />
      <TextEditOverlay
        editingText={editingText}
        setEditingText={setEditingText}
        getShapeById={(id) => state.getShapeById(id) as TextShape | undefined}
        onFinish={finishTextEdit}
        containerRef={containerRef as RefObject<HTMLDivElement>}
        canvasW={canvasW}
        canvasH={canvasH}
        shotX={shotX}
        shotY={shotY}
        shotW={shotW}
        shotH={shotH}
        natural={{ width: natural.width, height: natural.height }}
        pan={pan}
        viewScale={viewScale}
      />

      <BottomToolbar
        activeTool={state.activeTool}
        setActiveTool={state.setActiveTool}
        strokeColor={state.strokeColor}
        setStrokeColor={state.setStrokeColor}
        strokeWidth={state.strokeWidth}
        setStrokeWidth={state.setStrokeWidth}
        textSize={state.textSize}
        setTextSize={state.setTextSize}
        showTextControls={state.activeTool === 'text'}
        showTextSelectLevel={state.activeTool === 'text-select'}
        textSelectLevel={textSelectLevel}
        setTextSelectLevel={(lvl) => setTextSelectLevel(lvl)}
      />
    </div>
  );
});

export default ScreenshotEditor;

/* eslint-disable prettier/prettier */
import React, {
  RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
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
  import TextEditOverlay from './TextEditOverlay';
//
import { useTextDetection } from '../../hooks/use-text-detection';
import { usePiiMasking } from '../../hooks/use-pii-masking';

// ToolButton and ColorSwatch moved to './editor-tools'

interface ScreenshotEditorProps {
  screenshot: ScreenshotResult;
  onDelete: () => void;
  onCopy: (dataUrl: string) => Promise<boolean>;
  onSave: (dataUrl: string) => Promise<void>;
}

export default function ScreenshotEditor({
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
  const presentationDisabled = presentation.padding === 0 && presentation.inset === 0;
  const canvasW = presentationDisabled ? natural.width : layout.canvas.width;
  const canvasH = presentationDisabled ? natural.height : layout.canvas.height;
  const shotX = presentationDisabled ? 0 : layout.shot.x;
  const shotY = presentationDisabled ? 0 : layout.shot.y;
  const shotW = presentationDisabled ? natural.width : layout.shot.width;
  const shotH = presentationDisabled ? natural.height : layout.shot.height;

  // Export/presentation scaling glue
  const { exportDataUrl } = useExportGlue({
    stageRef: exportStageRef,
    natural: { width: natural.width, height: natural.height },
    shapes: state.shapes,
    presentation,
    setIsExporting,
  });

  useEffect(() => {
    const updateFit = () => {
      const parent = containerRef.current;
      if (!parent) return;

      // Panels are overlays; do not reduce available area by their width.
      // Keep only a small safety margin so the background can fill the space.
      const horizontalMargin = 32; // total (left+right)
      const maxWidth = Math.max(1, parent.clientWidth - horizontalMargin);

      // Fill horizontally: prefer width fit and allow height to overflow (pan handles it)
      const widthFit = maxWidth / canvasW;

      // Cap to avoid extreme zoom-in; allow modest upscaling to fill width for smaller canvases
      const next = Math.min(1.1, Math.max(0.05, widthFit));
      setFitScale(next);
    };
    updateFit();
    window.addEventListener('resize', updateFit);
    return () => window.removeEventListener('resize', updateFit);
  }, [canvasW, canvasH, presentationDisabled]);


  // dantavious.w20@gmail.com

  const toImageCoords = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = containerRef.current?.getBoundingClientRect();
      if (!bounds) return { x: 0, y: 0 };
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const stageTopLeftX = centerX - (canvasW * viewScale) / 2 + pan.x;
      const stageTopLeftY = centerY - (canvasH * viewScale) / 2 + pan.y;
      // Convert screen pixels to layout coordinates, then offset by shot origin
      const layoutX = (clientX - stageTopLeftX) / viewScale - shotX;
      const layoutY = (clientY - stageTopLeftY) / viewScale - shotY;

      // Map from layout coordinates to natural image coordinates
      const x = Math.max(
        0,
        Math.min(
          natural.width,
          (layoutX / Math.max(1, shotW)) * natural.width,
        ),
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
  const draggedShapeIdRef = useRef<string | null>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<
    'nw' | 'ne' | 'sw' | 'se' | null
  >(null);
  const resizeStartRef = useRef<
    | null
    | {
        left: number;
        top: number;
        right: number;
        bottom: number;
        shapeId: string;
        handle: 'nw' | 'ne' | 'sw' | 'se';
      }
  >(null);
  const [isPanning, setIsPanning] = useState(false);
  const panLast = useRef<{ x: number; y: number } | null>(null);
  const [editingText, setEditingText] = useState<null | {
    id: string;
    value: string;
  }>(null);

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
      if (options.tag) (r as any).tag = options.tag;
      return r;
    },
    [],
  );
  const { status: ocrStatus, words, lines, paragraphs } = useTextDetection(
    screenshot.imageDataUrl,
  );
  const [textSelectLevel, setTextSelectLevel] = useState<'word' | 'line' | 'paragraph'>(
    'word',
  );
  const pii = usePiiMasking({
    screenshot,
    ocr: { status: ocrStatus, words, lines, paragraphs },
    createRectForBox,
    editorApi: {
      shapes: state.shapes,
      addShapes: state.addShapes,
      deleteShapesByIds: state.deleteShapesByIds,
      getShapeById: state.getShapeById,
      getBoundsForShape,
    },
  });

  const selectableItems = useMemo(() => {
    if (textSelectLevel === 'word') return words;
    if (textSelectLevel === 'line') return lines;
    return paragraphs;
  }, [textSelectLevel, words, lines, paragraphs]);

  // PII masking handled by usePiiMasking
  const deleteSelectedShapePiiAware = useCallback(() => {
    const id = state.selectedShapeId;
    if (!id) return;
    pii.deletePiiForShapeId(id);
    state.deleteSelectedShape();
  }, [state, pii]);

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
    onDeleteSelected: deleteSelectedShapePiiAware,
    onEscape: () => state.selectShape(null),
    setZoom: (updater) => setZoom(typeof updater === 'number' ? updater : updater(zoom)),
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
        const contains = (b: { x: number; y: number; width: number; height: number }) =>
          x >= b.x && y >= b.y && x <= b.x + b.width && y <= b.y + b.height;
        const pool = selectableItems;
        const hit = pool.find((item) => contains(item.bbox));
        const box: { x: number; y: number; width: number; height: number } | null = hit
          ? hit.bbox
          : null;
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
        setIsPanning(true);
        panLast.current = { x: e.clientX, y: e.clientY };
        return;
      }
      const { x, y } = toImageCoords(e.clientX, e.clientY);
      if (state.activeTool === 'select') {
        const hit = hitTest(x, y);
        state.selectShape(hit);
        if (hit) {
          setIsDragging(true);
          dragLastPos.current = { x, y };
          draggedShapeIdRef.current = hit;
        } else if (e.button === 0) {
          // Empty space: start panning with left button
          setIsPanning(true);
          panLast.current = { x: e.clientX, y: e.clientY };
        }
        return;
      }
      if (state.activeTool === 'text' && e.button === 0) {
        e.preventDefault();
        e.stopPropagation();
        const shape = createNewShapeFromTool('text', {
          x,
          y,
          strokeColor: state.strokeColor,
          strokeWidth: state.strokeWidth,
          textSize: state.textSize,
        }) as TextShape;
        state.startProvisionalShape(shape);
        state.commitProvisionalShape();
        // Defer opening the input until after commit renders
        requestAnimationFrame(() => {
          setEditingText({ id: shape.id, value: '' });
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
        const r = shape as RectShape;
        r.fillColor = '#000000';
        r.strokeColor = 'transparent';
        r.opacity = 1;
        r.radius = 2;
        (r as any).tag = 'pii-manual';
      }
      state.startProvisionalShape(shape);
      setIsPointerDown(true);
    },
    [state, toImageCoords, hitTest, isSpacePressed, selectableItems, createRectForBox, pii.censorPII],
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
        state.updateShape(start.shapeId, (s) => {
          if (s.type !== 'rect') return s;
          const r = s as RectShape;
          return { ...r, x: nx, y: ny, width: nw, height: nh } as RectShape;
        });
        pii.updateMaskForShape(start.shapeId, { x: nx, y: ny, width: nw, height: nh });
        return;
      }
      if (isDragging && dragLastPos.current && state.selectedShapeId) {
        const dx = x - dragLastPos.current.x;
        const dy = y - dragLastPos.current.y;
        dragLastPos.current = { x, y };
        state.moveSelectedShapeBy(dx, dy);
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
    [isPointerDown, isDragging, state, toImageCoords, isPanning, isResizing, resizeHandle, natural.width, natural.height, pii],
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
      return;
    }
    if (isDragging) {
      setIsDragging(false);
      const draggedId = draggedShapeIdRef.current;
      draggedShapeIdRef.current = null;
      if (draggedId) {
        pii.syncDraggedMaskBounds(draggedId);
      }
      dragLastPos.current = null;
      return;
    }
    if (!isPointerDown) return;
    setIsPointerDown(false);
    if (state.provisionalShape) {
      const s = state.provisionalShape as EditorShape;
      const tag = (s as any)?.tag as string | undefined;
      const bounds = getBoundsForShapeMemo(s);
      state.commitProvisionalShape();
      if (tag && tag.startsWith('pii-')) {
        pii.recordManualMaskOnCommit(s, bounds);
      }
    }
  }, [isPointerDown, isDragging, isPanning, state, getBoundsForShapeMemo, isResizing, pii]);

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
        const panX =
          stageTopLeftNextX - (centerX - (canvasW * nextScale) / 2);
        const panY =
          stageTopLeftNextY - (centerY - (canvasH * nextScale) / 2);
        setZoom(nextZoom);
        setPan({ x: panX, y: panY });
      } else {
        // Pan with wheel (less aggressive)
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

  // (Per-window keyboard handled by useEditorShortcuts)

  // Removed nested component definitions (use top-level ToolButton and ColorSwatch)

  return (
    <div
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
        layout={{ frame: layout.frame, shot: layout.shot, canvas: layout.canvas }}
        pan={pan}
        viewScale={viewScale}
        presentation={presentation}
        screenshotUrl={screenshot.imageDataUrl}
        containerRef={containerRef}
        imgRef={imgRef}
        exportStageRef={exportStageRef}
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
            setEditingText({ id: shape.id, value: (shape as TextShape).text });
          }
        }}
        onKeyDown={(e) => {
          if ((e.key === 'Backspace' || e.key === 'Delete') && !editingText) {
            e.preventDefault();
            deleteSelectedShapePiiAware();
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          setIsPanning(true);
          panLast.current = { x: e.clientX, y: e.clientY };
        }}
        shapes={state.shapes}
        provisionalShape={state.provisionalShape as EditorShape | null}
        showOcrOverlay={state.activeTool === 'text-select' && ocrStatus === 'done'}
        ocrBoxes={selectableItems.map((it) => it.bbox)}
        ocrKeyPrefix={`ocr-${textSelectLevel}`}
        renderSelectionOverlay={() => {
          if (!state.selectedShapeId) return null;
          const selected = state.getShapeById(state.selectedShapeId!);
          if (!selected) return null;
          const b = getBoundsForShapeMemo(selected);
          const handleSize = Math.max(6, 6 + selected.strokeWidth * 0.5);
          const pad = Math.max(4, selected.strokeWidth);
          return (
            <g pointerEvents="none">
              <rect
                x={b.x - pad}
                y={b.y - pad}
                width={Math.max(1, b.width) + pad * 2}
                height={Math.max(1, b.height) + pad * 2}
                fill="none"
                stroke="#60a5fa"
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              {/* NW */}
              <rect
                x={b.x - handleSize}
                y={b.y - handleSize}
                width={handleSize}
                height={handleSize}
                fill="#60a5fa"
                rx={2}
                pointerEvents="all"
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (!state.selectedShapeId) return;
                  setIsResizing(true);
                  setResizeHandle('nw');
                  resizeStartRef.current = {
                    left: b.x,
                    top: b.y,
                    right: b.x + b.width,
                    bottom: b.y + b.height,
                    shapeId: state.selectedShapeId,
                    handle: 'nw',
                  } as any;
                }}
              />
              {/* NE */}
              <rect
                x={b.x + b.width}
                y={b.y - handleSize}
                width={handleSize}
                height={handleSize}
                fill="#60a5fa"
                rx={2}
                pointerEvents="all"
                style={{ cursor: 'nesw-resize' }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (!state.selectedShapeId) return;
                  setIsResizing(true);
                  setResizeHandle('ne');
                  resizeStartRef.current = {
                    left: b.x,
                    top: b.y,
                    right: b.x + b.width,
                    bottom: b.y + b.height,
                    shapeId: state.selectedShapeId,
                    handle: 'ne',
                  } as any;
                }}
              />
              {/* SW */}
              <rect
                x={b.x - handleSize}
                y={b.y + b.height}
                width={handleSize}
                height={handleSize}
                fill="#60a5fa"
                rx={2}
                pointerEvents="all"
                style={{ cursor: 'nesw-resize' }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (!state.selectedShapeId) return;
                  setIsResizing(true);
                  setResizeHandle('sw');
                  resizeStartRef.current = {
                    left: b.x,
                    top: b.y,
                    right: b.x + b.width,
                    bottom: b.y + b.height,
                    shapeId: state.selectedShapeId,
                    handle: 'sw',
                  } as any;
                }}
              />
              {/* SE */}
              <rect
                x={b.x + b.width}
                y={b.y + b.height}
                width={handleSize}
                height={handleSize}
                fill="#60a5fa"
                rx={2}
                pointerEvents="all"
                style={{ cursor: 'nwse-resize' }}
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  if (!state.selectedShapeId) return;
                  setIsResizing(true);
                  setResizeHandle('se');
                  resizeStartRef.current = {
                    left: b.x,
                    top: b.y,
                    right: b.x + b.width,
                    bottom: b.y + b.height,
                    shapeId: state.selectedShapeId,
                    handle: 'se',
                  } as any;
                }}
              />
              {/* Inline delete button */}
              <g
                pointerEvents="all"
                onPointerDown={(ev) => {
                  ev.stopPropagation();
                  deleteSelectedShapePiiAware();
                }}
                style={{ cursor: 'pointer' }}
              >
                <rect
                  x={b.x + b.width + pad + 8}
                  y={b.y - pad - 28}
                  width={28}
                  height={28}
                  rx={8}
                  fill="#0f172a"
                  stroke="#1f2937"
                />
                <path
                  d={`M ${b.x + b.width + pad + 16} ${b.y - pad - 16} l 8 8 M ${b.x + b.width + pad + 24} ${b.y - pad - 16} l -8 8`}
                  stroke="#f87171"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </g>
            </g>
          );
        }}
      />
      <SidePanel settings={presentation} onChange={presActions} />
      <TextEditOverlay
        editingText={editingText}
        setEditingText={setEditingText}
        getShapeById={(id) => state.getShapeById(id) as TextShape | undefined}
        updateTextShape={state.updateTextShape}
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
}

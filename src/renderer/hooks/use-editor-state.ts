import { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import type { EditorPreferences } from '../../shared/ipc-types';
import { createRendererLogger } from '../utils/logger';

const logger = createRendererLogger('use-editor-state');

export type ToolType =
  | 'select'
  | 'pen'
  | 'highlighter'
  | 'rect'
  | 'ellipse'
  | 'arrow'
  | 'text'
  | 'text-select';

export interface BaseShape {
  id: string;
  type: ToolType;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  opacity?: number;
  tag?: string;
}

export interface PenShape extends BaseShape {
  type: 'pen' | 'highlighter';
  points: Array<{ x: number; y: number }>;
}

export interface RectShape extends BaseShape {
  type: 'rect';
  x: number;
  y: number;
  width: number;
  height: number;
  radius?: number;
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse';
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

export interface ArrowShape extends BaseShape {
  type: 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface TextShape extends BaseShape {
  type: 'text';
  x: number;
  y: number;
  text: string;
  fontSize: number;
  fontWeight?: number;
  fontFamily?: string;
}

export type EditorShape =
  | PenShape
  | RectShape
  | EllipseShape
  | ArrowShape
  | TextShape;

export interface EditorState {
  shapes: EditorShape[];
  selectedShapeId: string | null;
  activeTool: ToolType;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  textSize: number;
}

export interface UseEditorStateResult extends EditorState {
  setActiveTool: (tool: ToolType) => void;
  setStrokeColor: (color: string) => void;
  setFillColor: (color: string) => void;
  setStrokeWidth: (width: number) => void;
  setTextSize: (size: number) => void;
  addShape: (shape: EditorShape) => string;
  addShapes: (newShapes: EditorShape[]) => string[];
  updateShape: (
    id: string,
    updater: (shape: EditorShape) => EditorShape,
  ) => void;
  startProvisionalShape: (shape: EditorShape) => void;
  updateProvisionalShape: (
    updater: (shape: EditorShape) => EditorShape,
  ) => void;
  commitProvisionalShape: () => void;
  cancelProvisionalShape: () => void;
  selectShape: (id: string | null) => void;
  moveSelectedShapeBy: (dx: number, dy: number) => void;
  updateTextShape: (id: string, text: string) => void;
  deleteSelectedShape: () => void;
  deleteShapesByIds: (ids: string[]) => void;
  deleteShapeById: (id: string) => void;
  clearAllShapes: () => void;
  /** Starts a drag, resize or text edit: changes skip the undo stack. */
  beginGesture: () => void;
  /** Ends the gesture with one undo entry, if anything changed. */
  endGesture: () => void;
  undo: () => void;
  redo: () => void;
  hasUndo: boolean;
  hasRedo: boolean;
  getShapeById: (id: string) => EditorShape | undefined;
  provisionalShape: EditorShape | null;
}

const MAX_UNDO_STACK_SIZE = 50;
const MAX_REDO_STACK_SIZE = 50;

function sameShapes(a: EditorShape[], b: EditorShape[]): boolean {
  return a.length === b.length && a.every((shape, i) => shape === b[i]);
}

function generateId(): string {
  return `shape_${Math.random().toString(36).slice(2, 10)}`;
}

export function createNewShapeFromTool(
  tool: ToolType,
  options: Partial<{
    x: number;
    y: number;
    strokeColor: string;
    fillColor: string;
    strokeWidth: number;
    textSize: number;
  }> = {},
): EditorShape {
  const strokeColor = options.strokeColor ?? '#ef4444';
  const fillColor = options.fillColor ?? 'transparent';
  const strokeWidth = options.strokeWidth ?? 3;
  const x = options.x ?? 0;
  const y = options.y ?? 0;
  const textSize = options.textSize ?? 18;

  if (tool === 'pen' || tool === 'highlighter') {
    return {
      id: generateId(),
      type: tool,
      points: [{ x, y }],
      strokeColor,
      strokeWidth,
      opacity: tool === 'highlighter' ? 0.4 : 1,
    };
  }
  if (tool === 'rect') {
    return {
      id: generateId(),
      type: 'rect',
      x,
      y,
      width: 0,
      height: 0,
      strokeColor,
      fillColor,
      strokeWidth,
      radius: 6,
    };
  }
  if (tool === 'ellipse') {
    return {
      id: generateId(),
      type: 'ellipse',
      cx: x,
      cy: y,
      rx: 0,
      ry: 0,
      strokeColor,
      fillColor,
      strokeWidth,
    };
  }
  if (tool === 'arrow') {
    return {
      id: generateId(),
      type: 'arrow',
      x1: x,
      y1: y,
      x2: x,
      y2: y,
      strokeColor,
      strokeWidth,
    };
  }
  // text
  return {
    id: generateId(),
    type: 'text',
    x,
    y,
    text: 'Text',
    strokeColor,
    strokeWidth,
    fontSize: textSize,
  };
}

export function useEditorState(): UseEditorStateResult {
  const [shapes, setShapes] = useState<EditorShape[]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [strokeColor, setStrokeColor] = useState<string>('#ef4444');
  const [fillColor, setFillColor] = useState<string>('transparent');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [textSize, setTextSize] = useState<number>(18);
  const [provisionalShape, setProvisionalShape] = useState<EditorShape | null>(
    null,
  );
  const [undoStack, setUndoStack] = useState<EditorShape[][]>([]);
  const [redoStack, setRedoStack] = useState<EditorShape[][]>([]);
  // The newest shapes and selection, including updates React has not rendered
  // yet, so several changes in one event build on each other.
  const latestShapesRef = useRef(shapes);
  latestShapesRef.current = shapes;
  const selectedShapeIdRef = useRef(selectedShapeId);
  selectedShapeIdRef.current = selectedShapeId;
  // Shapes from before the open gesture, or null when none is open.
  const gestureBaseRef = useRef<EditorShape[] | null>(null);

  const lastEditorPrefsRef = useRef<EditorPreferences | null>(null);

  // Load editor preferences and keep changed defaults in sync across windows.
  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return () => {};
    let active = true;

    const applyEditorPrefs = (
      editor: EditorPreferences | undefined,
      initial: boolean,
    ) => {
      if (!active || !editor) return;
      const prev = lastEditorPrefsRef.current;
      if (
        initial ||
        !prev ||
        editor.defaultStrokeColor !== prev.defaultStrokeColor
      ) {
        setStrokeColor(editor.defaultStrokeColor);
      }
      if (
        initial ||
        !prev ||
        editor.defaultFillColor !== prev.defaultFillColor
      ) {
        setFillColor(editor.defaultFillColor);
      }
      if (
        initial ||
        !prev ||
        editor.defaultStrokeWidth !== prev.defaultStrokeWidth
      ) {
        setStrokeWidth(editor.defaultStrokeWidth);
      }
      if (initial || !prev || editor.defaultTextSize !== prev.defaultTextSize) {
        setTextSize(editor.defaultTextSize);
      }
      lastEditorPrefsRef.current = editor;
    };

    const loadPreferences = async () => {
      try {
        const preferences = await api.invoke('get-preferences', {});
        applyEditorPrefs(preferences?.editor, true);
      } catch (error) {
        logger.warn('Failed to load editor preferences', error);
      }
    };

    loadPreferences();

    const unsubscribe =
      typeof api.on === 'function'
        ? api.on('preferences-changed', (next) =>
            applyEditorPrefs(next?.editor, false),
          )
        : undefined;

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  const pushUndo = useCallback((entry: EditorShape[]) => {
    setUndoStack((prev) => [...prev, entry].slice(-MAX_UNDO_STACK_SIZE));
    setRedoStack([]);
  }, []);

  const snapshot = useCallback(
    (next: EditorShape[]) => {
      if (!gestureBaseRef.current) pushUndo(latestShapesRef.current);
      latestShapesRef.current = next;
      setShapes(next);
    },
    [pushUndo],
  );

  const beginGesture = useCallback(() => {
    if (gestureBaseRef.current) return;
    gestureBaseRef.current = latestShapesRef.current;
  }, []);

  const endGesture = useCallback(() => {
    const base = gestureBaseRef.current;
    gestureBaseRef.current = null;
    if (base && !sameShapes(base, latestShapesRef.current)) pushUndo(base);
  }, [pushUndo]);

  const startProvisionalShape = useCallback((shape: EditorShape) => {
    setProvisionalShape(shape);
  }, []);

  const updateProvisionalShape = useCallback(
    (updater: (shape: EditorShape) => EditorShape) => {
      setProvisionalShape((prev) => (prev ? updater(prev) : prev));
    },
    [],
  );

  const commitProvisionalShape = useCallback(() => {
    if (!provisionalShape) return;
    snapshot([...latestShapesRef.current, provisionalShape]);
    selectedShapeIdRef.current = provisionalShape.id;
    setSelectedShapeId(provisionalShape.id);
    setProvisionalShape(null);
  }, [provisionalShape, snapshot]);

  const cancelProvisionalShape = useCallback(() => {
    setProvisionalShape(null);
  }, []);

  const selectShape = useCallback((id: string | null) => {
    selectedShapeIdRef.current = id;
    setSelectedShapeId(id);
  }, []);

  const moveSelectedShapeBy = useCallback(
    (dx: number, dy: number) => {
      const targetId = selectedShapeIdRef.current;
      if (!targetId) return;
      const next = latestShapesRef.current.map((s) => {
        if (s.id !== targetId) return s;
        switch (s.type) {
          case 'rect':
            return { ...s, x: s.x + dx, y: s.y + dy } as RectShape;
          case 'ellipse':
            return { ...s, cx: s.cx + dx, cy: s.cy + dy } as EllipseShape;
          case 'arrow':
            return {
              ...s,
              x1: s.x1 + dx,
              y1: s.y1 + dy,
              x2: s.x2 + dx,
              y2: s.y2 + dy,
            } as ArrowShape;
          case 'text':
            return { ...s, x: s.x + dx, y: s.y + dy } as TextShape;
          case 'pen':
          case 'highlighter':
            return {
              ...s,
              points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })),
            } as PenShape;
          default:
            return s;
        }
      });
      snapshot(next);
    },
    [snapshot],
  );

  const updateTextShape = useCallback(
    (id: string, text: string) => {
      const next = latestShapesRef.current.map((s) =>
        s.id === id && s.type === 'text' ? ({ ...s, text } as TextShape) : s,
      );
      snapshot(next);
    },
    [snapshot],
  );

  const deleteSelectedShape = useCallback(() => {
    const targetId = selectedShapeIdRef.current;
    if (!targetId) return;
    const next = latestShapesRef.current.filter((s) => s.id !== targetId);
    snapshot(next);
    selectedShapeIdRef.current = null;
    setSelectedShapeId(null);
  }, [snapshot]);

  const deleteShapesByIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const { current } = latestShapesRef;
      const next = current.filter((s) => !idSet.has(s.id));
      if (next.length === current.length) return;
      snapshot(next);
      if (selectedShapeIdRef.current && idSet.has(selectedShapeIdRef.current)) {
        selectedShapeIdRef.current = null;
        setSelectedShapeId(null);
      }
    },
    [snapshot],
  );

  const deleteShapeById = useCallback(
    (id: string) => {
      const next = latestShapesRef.current.filter((s) => s.id !== id);
      snapshot(next);
      if (selectedShapeIdRef.current === id) {
        selectedShapeIdRef.current = null;
        setSelectedShapeId(null);
      }
    },
    [snapshot],
  );

  const clearAllShapes = useCallback(() => {
    if (latestShapesRef.current.length === 0) return;
    snapshot([]);
    selectedShapeIdRef.current = null;
    setSelectedShapeId(null);
  }, [snapshot]);

  const updateShape = useCallback(
    (id: string, updater: (shape: EditorShape) => EditorShape) => {
      const { current } = latestShapesRef;
      const idx = current.findIndex((s) => s.id === id);
      if (idx < 0) return;
      const next = current.map((s, i) => (i === idx ? updater(s) : s));
      snapshot(next);
    },
    [snapshot],
  );

  const syncSelectionAfterRestore = useCallback((restored: EditorShape[]) => {
    if (
      selectedShapeIdRef.current &&
      !restored.some((s) => s.id === selectedShapeIdRef.current)
    ) {
      selectedShapeIdRef.current = null;
      setSelectedShapeId(null);
    }
  }, []);

  const undo = useCallback(() => {
    if (undoStack.length === 0) return;
    gestureBaseRef.current = null;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack(undoStack.slice(0, -1));
    setRedoStack(
      [latestShapesRef.current, ...redoStack].slice(0, MAX_REDO_STACK_SIZE),
    );
    latestShapesRef.current = previous;
    setShapes(previous);
    syncSelectionAfterRestore(previous);
  }, [undoStack, redoStack, syncSelectionAfterRestore]);

  const redo = useCallback(() => {
    if (redoStack.length === 0) return;
    gestureBaseRef.current = null;
    const [next, ...rest] = redoStack;
    setRedoStack(rest);
    setUndoStack(
      [...undoStack, latestShapesRef.current].slice(-MAX_UNDO_STACK_SIZE),
    );
    latestShapesRef.current = next;
    setShapes(next);
    syncSelectionAfterRestore(next);
  }, [undoStack, redoStack, syncSelectionAfterRestore]);

  const hasUndo = useMemo(() => undoStack.length > 0, [undoStack.length]);
  const hasRedo = useMemo(() => redoStack.length > 0, [redoStack.length]);

  const getShapeById = useCallback(
    (id: string) => latestShapesRef.current.find((s) => s.id === id),
    [],
  );

  const addShape = useCallback(
    (shape: EditorShape) => {
      const next = [...latestShapesRef.current, shape];
      snapshot(next);
      return shape.id;
    },
    [snapshot],
  );

  const addShapes = useCallback(
    (newShapes: EditorShape[]) => {
      if (newShapes.length === 0) return [];
      const next = [...latestShapesRef.current, ...newShapes];
      snapshot(next);
      return newShapes.map((s) => s.id);
    },
    [snapshot],
  );

  return {
    shapes,
    selectedShapeId,
    activeTool,
    strokeColor,
    fillColor,
    strokeWidth,
    textSize,
    setActiveTool,
    setStrokeColor,
    setFillColor,
    setStrokeWidth,
    setTextSize,
    addShape,
    addShapes,
    updateShape,
    startProvisionalShape,
    updateProvisionalShape,
    commitProvisionalShape,
    cancelProvisionalShape,
    selectShape,
    moveSelectedShapeBy,
    updateTextShape,
    deleteSelectedShape,
    deleteShapesByIds,
    deleteShapeById,
    clearAllShapes,
    beginGesture,
    endGesture,
    undo,
    redo,
    hasUndo,
    hasRedo,
    getShapeById,
    provisionalShape,
  };
}

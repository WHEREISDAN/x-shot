import { useCallback, useMemo, useState, useEffect } from 'react';
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
  undo: () => void;
  redo: () => void;
  hasUndo: boolean;
  hasRedo: boolean;
  getShapeById: (id: string) => EditorShape | undefined;
  provisionalShape: EditorShape | null;
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

  // Memory management constants
  const MAX_UNDO_STACK_SIZE = 50;
  const MAX_REDO_STACK_SIZE = 50;

  // Load editor preferences on initialization
  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const api = window?.electron?.ipcRenderer;
        if (!api) return;

        const preferences = await api.invoke('get-preferences', {});
        if (preferences?.editor) {
          setStrokeColor(preferences.editor.defaultStrokeColor);
          setFillColor(preferences.editor.defaultFillColor);
          setStrokeWidth(preferences.editor.defaultStrokeWidth);
          setTextSize(preferences.editor.defaultTextSize);
        }
      } catch (error) {
        logger.warn('Failed to load editor preferences', error);
      }
    };

    loadPreferences();
  }, []);

  const snapshot = useCallback(
    (next: EditorShape[]) => {
      setUndoStack((prev) => {
        const newStack = [...prev, shapes];
        // Limit stack size to prevent memory bloat
        if (newStack.length > MAX_UNDO_STACK_SIZE) {
          return newStack.slice(-MAX_UNDO_STACK_SIZE);
        }
        return newStack;
      });
      setRedoStack([]);
      setShapes(next);
    },
    [shapes, MAX_UNDO_STACK_SIZE],
  );

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
    setProvisionalShape((current) => {
      if (!current) return null;
      const next = [...shapes, current];
      snapshot(next);
      setSelectedShapeId(current.id);
      return null;
    });
  }, [shapes, snapshot]);

  const cancelProvisionalShape = useCallback(() => {
    setProvisionalShape(null);
  }, []);

  const selectShape = useCallback((id: string | null) => {
    setSelectedShapeId(id);
  }, []);

  const moveSelectedShapeBy = useCallback(
    (dx: number, dy: number) => {
      if (!selectedShapeId) return;
      const next = shapes.map((s) => {
        if (s.id !== selectedShapeId) return s;
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
    [selectedShapeId, shapes, snapshot],
  );

  const updateTextShape = useCallback(
    (id: string, text: string) => {
      const next = shapes.map((s) =>
        s.id === id && s.type === 'text' ? ({ ...s, text } as TextShape) : s,
      );
      snapshot(next);
    },
    [shapes, snapshot],
  );

  const deleteSelectedShape = useCallback(() => {
    if (!selectedShapeId) return;
    const next = shapes.filter((s) => s.id !== selectedShapeId);
    snapshot(next);
    setSelectedShapeId(null);
  }, [selectedShapeId, shapes, snapshot]);

  const deleteShapesByIds = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      const idSet = new Set(ids);
      const next = shapes.filter((s) => !idSet.has(s.id));
      if (next.length === shapes.length) return;
      snapshot(next);
      if (selectedShapeId && idSet.has(selectedShapeId))
        setSelectedShapeId(null);
    },
    [shapes, snapshot, selectedShapeId],
  );

  const deleteShapeById = useCallback(
    (id: string) => {
      const next = shapes.filter((s) => s.id !== id);
      snapshot(next);
      if (selectedShapeId === id) setSelectedShapeId(null);
    },
    [selectedShapeId, shapes, snapshot],
  );

  const clearAllShapes = useCallback(() => {
    if (shapes.length === 0) return;
    snapshot([]);
    setSelectedShapeId(null);
  }, [shapes, snapshot]);

  const updateShape = useCallback(
    (id: string, updater: (shape: EditorShape) => EditorShape) => {
      const idx = shapes.findIndex((s) => s.id === id);
      if (idx < 0) return;
      const next = shapes.map((s, i) => (i === idx ? updater(s) : s));
      snapshot(next);
    },
    [shapes, snapshot],
  );

  const undo = useCallback(() => {
    setUndoStack((prev) => {
      if (prev.length === 0) return prev;
      const last = prev[prev.length - 1];
      setRedoStack((r) => {
        const newStack = [shapes, ...r];
        // Limit redo stack size
        if (newStack.length > MAX_REDO_STACK_SIZE) {
          return newStack.slice(0, MAX_REDO_STACK_SIZE);
        }
        return newStack;
      });
      setShapes(last);
      return prev.slice(0, -1);
    });
  }, [shapes, MAX_REDO_STACK_SIZE]);

  const redo = useCallback(() => {
    setRedoStack((prev) => {
      if (prev.length === 0) return prev;
      const [first, ...rest] = prev;
      setUndoStack((u) => {
        const newStack = [...u, shapes];
        // Limit undo stack size
        if (newStack.length > MAX_UNDO_STACK_SIZE) {
          return newStack.slice(-MAX_UNDO_STACK_SIZE);
        }
        return newStack;
      });
      setShapes(first);
      return rest;
    });
  }, [shapes, MAX_UNDO_STACK_SIZE]);

  const hasUndo = useMemo(() => undoStack.length > 0, [undoStack.length]);
  const hasRedo = useMemo(() => redoStack.length > 0, [redoStack.length]);

  const getShapeById = useCallback(
    (id: string) => shapes.find((s) => s.id === id),
    [shapes],
  );

  const addShape = useCallback(
    (shape: EditorShape) => {
      const next = [...shapes, shape];
      snapshot(next);
      return shape.id;
    },
    [shapes, snapshot],
  );

  const addShapes = useCallback(
    (newShapes: EditorShape[]) => {
      if (newShapes.length === 0) return [];
      const next = [...shapes, ...newShapes];
      snapshot(next);
      return newShapes.map((s) => s.id);
    },
    [shapes, snapshot],
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
    undo,
    redo,
    hasUndo,
    hasRedo,
    getShapeById,
    provisionalShape,
  };
}

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ScreenshotSelection } from '../../shared/ipc-types';
import { clampToViewport, keepInViewport } from '../../shared/crop-geometry';

export interface SelectionArea extends ScreenshotSelection {}

export interface UseSelectionOptions {
  offsetX: number;
  offsetY: number;
  /** The display this overlay covers; sent with the selection. */
  displayId?: number;
}

export interface UseSelectionResult {
  selection: SelectionArea | null;
  isDragging: boolean;
  isResizing: boolean;
  resizeHandle: string | null;
  clear: () => void;
  overlayRects: {
    top: { left: number; top: number; width: number; height: number };
    left: { left: number; top: number; width: number; height: number };
    right: { left: number; top: number; width: number; height: number };
    bottom: { left: number; top: number; width: number; height: number };
  };
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  confirm: () => void;
}

function getHandleAtPoint(
  selection: SelectionArea,
  x: number,
  y: number,
): string | null {
  const HANDLE_SIZE = 14;
  const points = [
    { name: 'top-left', x: selection.x, y: selection.y },
    { name: 'top-right', x: selection.x + selection.width, y: selection.y },
    { name: 'bottom-left', x: selection.x, y: selection.y + selection.height },
    {
      name: 'bottom-right',
      x: selection.x + selection.width,
      y: selection.y + selection.height,
    },
    {
      name: 'top-middle',
      x: selection.x + selection.width / 2,
      y: selection.y,
    },
    {
      name: 'bottom-middle',
      x: selection.x + selection.width / 2,
      y: selection.y + selection.height,
    },
    {
      name: 'left-middle',
      x: selection.x,
      y: selection.y + selection.height / 2,
    },
    {
      name: 'right-middle',
      x: selection.x + selection.width,
      y: selection.y + selection.height / 2,
    },
  ];
  const hit = points.find(
    (p) => Math.abs(x - p.x) <= HANDLE_SIZE && Math.abs(y - p.y) <= HANDLE_SIZE,
  );
  return hit ? hit.name : null;
}

// The overlay covers exactly one display, so its viewport is that display.
const overlayViewport = () => ({
  width: window.innerWidth,
  height: window.innerHeight,
});

const GRID_SIZE = 8;
const MIN_SELECTION_SIZE = 10;
const snapToGrid = (value: number) => Math.round(value / GRID_SIZE) * GRID_SIZE;

export function useSelection({
  offsetX,
  offsetY,
  displayId,
}: UseSelectionOptions): UseSelectionResult {
  const [selection, setSelection] = useState<SelectionArea | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [isResizing, setResizing] = useState(false);
  const [isSelecting, setSelecting] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const resizeStartRef = useRef<{
    startX: number;
    startY: number;
    initialRect: SelectionArea;
  } | null>(null);
  const moveOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const isPointInSelection = useCallback(
    (x: number, y: number) => {
      if (!selection) return false;
      return (
        x >= selection.x &&
        x <= selection.x + selection.width &&
        y >= selection.y &&
        y <= selection.y + selection.height
      );
    },
    [selection],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const x = e.clientX;
      const y = e.clientY;

      if (isDragging || isResizing || isSelecting) {
        e.preventDefault();
        return;
      }

      if (selection) {
        const handle = getHandleAtPoint(selection, x, y);
        if (handle) {
          setResizing(true);
          setResizeHandle(handle);
          resizeStartRef.current = {
            startX: x,
            startY: y,
            initialRect: { ...selection },
          };
          e.preventDefault();
          return;
        }
      }

      if (isPointInSelection(x, y) && selection) {
        setDragging(true);
        moveOffsetRef.current = { x: x - selection.x, y: y - selection.y };
        e.preventDefault();
        return;
      }

      setDragging(false);
      setResizing(false);
      setSelecting(true);
      setResizeHandle(null);
      resizeStartRef.current = null;
      startRef.current = { x, y };
      setSelection({ x, y, width: 0, height: 0 });
      e.preventDefault();
    },
    [selection, isPointInSelection, isDragging, isResizing, isSelecting],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const currentX = e.clientX;
      const currentY = e.clientY;

      if (isResizing && resizeStartRef.current && resizeHandle) {
        const { startX, startY, initialRect } = resizeStartRef.current;
        const dx = currentX - startX;
        const dy = currentY - startY;
        const initialRight = initialRect.x + initialRect.width;
        const initialBottom = initialRect.y + initialRect.height;

        let left = initialRect.x;
        let top = initialRect.y;
        let right = initialRight;
        let bottom = initialBottom;

        const movesLeft =
          resizeHandle === 'top-left' ||
          resizeHandle === 'bottom-left' ||
          resizeHandle === 'left-middle';
        const movesRight =
          resizeHandle === 'top-right' ||
          resizeHandle === 'bottom-right' ||
          resizeHandle === 'right-middle';
        const movesTop =
          resizeHandle === 'top-left' ||
          resizeHandle === 'top-right' ||
          resizeHandle === 'top-middle';
        const movesBottom =
          resizeHandle === 'bottom-left' ||
          resizeHandle === 'bottom-right' ||
          resizeHandle === 'bottom-middle';

        if (movesLeft) {
          left = Math.min(
            snapToGrid(initialRect.x + dx),
            initialRight - MIN_SELECTION_SIZE,
          );
        }
        if (movesRight) {
          right = Math.max(
            snapToGrid(initialRight + dx),
            initialRect.x + MIN_SELECTION_SIZE,
          );
        }
        if (movesTop) {
          top = Math.min(
            snapToGrid(initialRect.y + dy),
            initialBottom - MIN_SELECTION_SIZE,
          );
        }
        if (movesBottom) {
          bottom = Math.max(
            snapToGrid(initialBottom + dy),
            initialRect.y + MIN_SELECTION_SIZE,
          );
        }

        setSelection(
          clampToViewport(
            {
              x: left,
              y: top,
              width: right - left,
              height: bottom - top,
            },
            overlayViewport(),
          ),
        );
        return;
      }

      if (isDragging && selection) {
        setSelection(
          keepInViewport(
            {
              ...selection,
              x: snapToGrid(currentX - moveOffsetRef.current.x),
              y: snapToGrid(currentY - moveOffsetRef.current.y),
            },
            overlayViewport(),
          ),
        );
        return;
      }

      if (isSelecting) {
        const start = startRef.current;
        const left = Math.min(start.x, currentX);
        const top = Math.min(start.y, currentY);
        const width = Math.abs(currentX - start.x);
        const height = Math.abs(currentY - start.y);
        setSelection(
          clampToViewport(
            {
              x: snapToGrid(left),
              y: snapToGrid(top),
              width: snapToGrid(width),
              height: snapToGrid(height),
            },
            overlayViewport(),
          ),
        );
      }
    },
    [isDragging, isResizing, isSelecting, selection, resizeHandle],
  );

  const onMouseUp = useCallback(() => {
    setDragging(false);
    setResizing(false);
    setSelecting(false);
    setResizeHandle(null);
    resizeStartRef.current = null;
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    setDragging(false);
    setResizing(false);
    setSelecting(false);
    setResizeHandle(null);
    resizeStartRef.current = null;
  }, []);

  const overlayRects = useMemo(() => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    if (!selection) {
      return {
        top: { left: 0, top: 0, width: screenWidth, height: screenHeight },
        left: { left: 0, top: 0, width: 0, height: 0 },
        right: { left: 0, top: 0, width: 0, height: 0 },
        bottom: { left: 0, top: 0, width: 0, height: 0 },
      };
    }
    return {
      top: { left: 0, top: 0, width: screenWidth, height: selection.y },
      left: {
        left: 0,
        top: selection.y,
        width: selection.x,
        height: selection.height,
      },
      right: {
        left: selection.x + selection.width,
        top: selection.y,
        width: screenWidth - (selection.x + selection.width),
        height: selection.height,
      },
      bottom: {
        left: 0,
        top: selection.y + selection.height,
        width: screenWidth,
        height: screenHeight - (selection.y + selection.height),
      },
    };
  }, [selection]);

  const confirm = useCallback(() => {
    if (!selection) return;
    const payload: ScreenshotSelection = {
      x: selection.x + offsetX,
      y: selection.y + offsetY,
      width: selection.width,
      height: selection.height,
      displayId,
    };
    window.electron.ipcRenderer.sendMessage('screenshot-data', payload);
  }, [offsetX, offsetY, displayId, selection]);

  // Manage body classes for transparency
  useEffect(() => {
    document.documentElement.classList.add('screenshot-mode');
    document.body.classList.add('screenshot-mode');
    const root = document.getElementById('root');
    if (root) root.classList.add('screenshot-mode');
    return () => {
      document.documentElement.classList.remove('screenshot-mode');
      document.body.classList.remove('screenshot-mode');
      const rootEl = document.getElementById('root');
      if (rootEl) rootEl.classList.remove('screenshot-mode');
    };
  }, []);

  return {
    selection,
    isDragging,
    isResizing,
    resizeHandle,
    clear,
    overlayRects,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    confirm,
  };
}

export default useSelection;

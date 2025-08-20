import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { ScreenshotSelection } from '../../shared/ipc-types';

export interface SelectionArea extends ScreenshotSelection {}

export interface UseSelectionOptions {
  offsetX: number;
  offsetY: number;
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
  onKeyDown: (e: React.KeyboardEvent) => void;
  confirm: () => void;
}

function getHandleAtPoint(
  selection: SelectionArea,
  x: number,
  y: number,
): string | null {
  const HANDLE_SIZE = 14; // 7px radius from center
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

export function useSelection({
  offsetX,
  offsetY,
}: UseSelectionOptions): UseSelectionResult {
  const [selection, setSelection] = useState<SelectionArea | null>(null);
  const [isDragging, setDragging] = useState(false);
  const [isResizing, setResizing] = useState(false);
  const [isSelecting, setSelecting] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);
  const startRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
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

      // If we are already dragging or resizing, keep the interaction active
      // and do not let external hit-tests cancel it on a fresh mousedown.
      if (isDragging || isResizing || isSelecting) {
        e.preventDefault();
        return;
      }

      if (selection) {
        const handle = getHandleAtPoint(selection, x, y);
        if (handle) {
          setResizing(true);
          setResizeHandle(handle);
          startRef.current = { x, y };
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

      // Begin new selection
      setDragging(false);
      setResizing(false);
      setSelecting(true);
      setResizeHandle(null);
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
      const grid = 8;
      const snap = (v: number) => Math.round(v / grid) * grid;

      if (isResizing && selection && resizeHandle) {
        const dx = currentX - startRef.current.x;
        const dy = currentY - startRef.current.y;
        let { x, y, width, height } = selection;
        switch (resizeHandle) {
          case 'top-left':
            x += dx;
            y += dy;
            width -= dx;
            height -= dy;
            break;
          case 'top-right':
            y += dy;
            width += dx;
            height -= dy;
            break;
          case 'bottom-left':
            x += dx;
            width -= dx;
            height += dy;
            break;
          case 'bottom-right':
            width += dx;
            height += dy;
            break;
          case 'top-middle':
            y += dy;
            height -= dy;
            break;
          case 'bottom-middle':
            height += dy;
            break;
          case 'left-middle':
            x += dx;
            width -= dx;
            break;
          case 'right-middle':
            width += dx;
            break;
          default:
            break;
        }
        // Snap to grid
        x = snap(x);
        y = snap(y);
        width = Math.max(10, snap(width));
        height = Math.max(10, snap(height));
        setSelection({ x, y, width, height });
        startRef.current = { x: currentX, y: currentY };
        return;
      }

      if (isDragging && selection) {
        const newX = snap(currentX - moveOffsetRef.current.x);
        const newY = snap(currentY - moveOffsetRef.current.y);
        setSelection({
          ...selection,
          x: Math.max(0, newX),
          y: Math.max(0, newY),
        });
        return;
      }

      // Drawing new selection
      if (isSelecting) {
        const start = startRef.current;
        const left = Math.min(start.x, currentX);
        const top = Math.min(start.y, currentY);
        const width = Math.abs(currentX - start.x);
        const height = Math.abs(currentY - start.y);
        setSelection({ x: snap(left), y: snap(top), width: snap(width), height: snap(height) });
      }
    },
    [isDragging, isResizing, isSelecting, selection, resizeHandle],
  );

  const onMouseUp = useCallback(() => {
    setDragging(false);
    setResizing(false);
    setSelecting(false);
    setResizeHandle(null);
  }, []);

  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      try {
        window.electron.ipcRenderer.sendMessage('screenshot-cancel', undefined);
      } catch {
        // noop
      }
      window.close();
    }
  }, []);

  const clear = useCallback(() => {
    setSelection(null);
    setDragging(false);
    setResizing(false);
    setSelecting(false);
    setResizeHandle(null);
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
    };
    window.electron.ipcRenderer.sendMessage('screenshot-data', payload);
  }, [offsetX, offsetY, selection]);

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
    onKeyDown,
    confirm,
  };
}

export default useSelection;

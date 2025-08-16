import { useCallback, useEffect, useState } from 'react';

export interface UseEditorShortcutsOptions {
  editingActive: boolean;
  suppressWhenInputFocused?: boolean;
  onCopy: () => void | Promise<void>;
  onSave: () => void | Promise<void>;
  onUndo: () => void;
  onRedo: () => void;
  onDeleteSelected: () => void;
  onEscape: () => void;
  setZoom: (updater: (prev: number) => number | number) => void;
  resetView: () => void;
  setPan: (next: { x: number; y: number }) => void;
}

export function useEditorShortcuts({
  editingActive,
  suppressWhenInputFocused = true,
  onCopy,
  onSave,
  onUndo,
  onRedo,
  onDeleteSelected,
  onEscape,
  setZoom,
  resetView,
  setPan,
}: UseEditorShortcutsOptions): { isSpacePressed: boolean } {
  const [isSpacePressed, setIsSpacePressed] = useState(false);

  const shouldSuppress = useCallback(() => {
    if (editingActive) return true;
    if (!suppressWhenInputFocused) return false;
    const tag = (document.activeElement as HTMLElement | null)?.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      tag === 'BUTTON'
    );
  }, [editingActive, suppressWhenInputFocused]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        if (!isSpacePressed) setIsSpacePressed(true);
      }

      if (shouldSuppress()) return;

      if ((e.metaKey || e.ctrlKey) && !e.shiftKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoom((z) => Math.min(8, (typeof z === 'number' ? z : 1) * 1.1));
          return;
        }
        if (e.key === '-') {
          e.preventDefault();
          setZoom((z) => Math.max(0.25, (typeof z === 'number' ? z : 1) / 1.1));
          return;
        }
        if (e.key === '0') {
          e.preventDefault();
          resetView();
          setPan({ x: 0, y: 0 });
          return;
        }
      }

      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'c'
      ) {
        e.preventDefault();
        Promise.resolve(onCopy()).catch(() => {});
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 's'
      ) {
        e.preventDefault();
        Promise.resolve(onSave()).catch(() => {});
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        !e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault();
        onUndo();
        return;
      }
      if (
        (e.metaKey || e.ctrlKey) &&
        e.shiftKey &&
        e.key.toLowerCase() === 'z'
      ) {
        e.preventDefault();
        onRedo();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        onDeleteSelected();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onEscape();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [
    isSpacePressed,
    shouldSuppress,
    onCopy,
    onSave,
    onUndo,
    onRedo,
    onDeleteSelected,
    onEscape,
    setZoom,
    resetView,
    setPan,
  ]);

  return { isSpacePressed };
}

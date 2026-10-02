import { useCallback, useEffect, useState } from 'react';

// Input types that take typed text; checkboxes, buttons and the like do not.
const TEXT_INPUT_TYPES = new Set([
  '',
  'text',
  'search',
  'email',
  'url',
  'tel',
  'password',
  'number',
]);

/**
 * True while the user is typing: shortcuts must not steal those keys. A
 * focused toolbar button or checkbox is not typing, so shortcuts still work.
 */
export function isTextEntryElement(element: Element | null): boolean {
  if (!element) return false;
  const editable = element.getAttribute('contenteditable');
  if (
    (element as HTMLElement).isContentEditable ||
    (editable !== null && editable !== 'false')
  ) {
    return true;
  }
  const tag = element.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (element.getAttribute('type') ?? '').toLowerCase();
  return TEXT_INPUT_TYPES.has(type);
}

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
    return isTextEntryElement(document.activeElement);
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

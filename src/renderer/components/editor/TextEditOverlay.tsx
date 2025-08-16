import React, { useEffect, useMemo, useRef } from 'react';
import type { TextShape } from '../../hooks/use-editor-state';

export interface TextEditState {
  id: string;
  value: string;
}

export interface TextEditOverlayProps {
  editingText: TextEditState | null;
  setEditingText: (next: TextEditState | null) => void;
  getShapeById: (id: string) => TextShape | undefined;
  updateTextShape: (id: string, text: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  // Stage geometry
  canvasW: number;
  canvasH: number;
  shotX: number;
  shotY: number;
  shotW: number;
  shotH: number;
  natural: { width: number; height: number };
  pan: { x: number; y: number };
  viewScale: number;
}

export default function TextEditOverlay({
  editingText,
  setEditingText,
  getShapeById,
  updateTextShape,
  containerRef,
  canvasW,
  canvasH,
  shotX,
  shotY,
  shotW,
  shotH,
  natural,
  pan,
  viewScale,
}: TextEditOverlayProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingText && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingText]);

  const positioning = useMemo(() => {
    if (!editingText) return null;
    const container = containerRef.current;
    if (!container) return null;
    const shape = getShapeById(editingText.id);
    if (!shape) return null;

    const centerX = container.clientWidth / 2;
    const centerY = container.clientHeight / 2;
    const stageTopLeftX = centerX - (canvasW * viewScale) / 2 + pan.x;
    const stageTopLeftY = centerY - (canvasH * viewScale) / 2 + pan.y;
    const px =
      stageTopLeftX + (shotX + (shape.x / natural.width) * shotW) * viewScale;
    const py =
      stageTopLeftY + (shotY + (shape.y / natural.height) * shotH) * viewScale;

    return {
      left: Math.round(px),
      top: Math.round(py),
      fontPx: Math.max(12, Math.round(shape.fontSize * viewScale)),
    };
  }, [
    editingText,
    containerRef,
    getShapeById,
    canvasW,
    canvasH,
    shotX,
    shotY,
    shotW,
    shotH,
    natural.width,
    natural.height,
    pan.x,
    pan.y,
    viewScale,
  ]);

  if (!editingText || !positioning) return null;

  return (
    <input
      ref={inputRef}
      type="text"
      value={editingText.value}
      onChange={(e) =>
        setEditingText({ ...editingText, value: e.target.value })
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          updateTextShape(editingText.id, editingText.value || '');
          setEditingText(null);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          setEditingText(null);
        }
      }}
      onBlur={() => {
        updateTextShape(editingText.id, editingText.value || '');
        setEditingText(null);
      }}
      style={{
        position: 'absolute',
        left: positioning.left,
        top: positioning.top,
        transform: 'translateY(-2px)',
        minWidth: 80,
        padding: '4px 6px',
        borderRadius: 6,
        border: '1px solid rgba(255,255,255,0.3)',
        outline: 'none',
        background: 'rgba(17,17,17,0.95)',
        color: 'white',
        fontSize: positioning.fontPx,
        zIndex: 5,
      }}
    />
  );
}

import React, { useEffect, useMemo, useRef } from 'react';
import type { TextShape } from '../../hooks/use-editor-state';
import styles from './TextEditOverlay.module.css';

// The input's border and padding, as in TextEditOverlay.module.css.
const BOX_LEFT = 1 + 5;
const BOX_TOP = 1 + 2;
const DEFAULT_FONT = '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto';

interface FontBox {
  /** Line height that holds exactly the font's ascent and descent. */
  lineHeight: number;
  /** From the top of that line down to the hanging baseline. */
  hangingTop: number;
}

/**
 * Where the stage's text starts vertically inside a line of the same font.
 * The stage draws text from its hanging baseline (dominant-baseline
 * "hanging"), so the input lines its hanging baseline up with it.
 */
function measureFont(font: string, fontPx: number): FontBox {
  const fallback = { lineHeight: Math.round(fontPx * 1.2), hangingTop: 0 };
  if (typeof OffscreenCanvas === 'undefined') return fallback;
  const context = new OffscreenCanvas(1, 1).getContext('2d');
  if (!context) return fallback;
  context.font = font;
  context.textBaseline = 'alphabetic';
  const metrics = context.measureText('Hg');
  const ascent = metrics.fontBoundingBoxAscent;
  const descent = metrics.fontBoundingBoxDescent;
  if (!Number.isFinite(ascent) || !Number.isFinite(descent)) return fallback;
  return {
    lineHeight: ascent + descent,
    hangingTop: ascent - metrics.hangingBaseline,
  };
}

export interface TextEditState {
  id: string;
  value: string;
  /** True for a shape the text tool just placed. */
  isNew: boolean;
}

export interface TextEditOverlayProps {
  editingText: TextEditState | null;
  setEditingText: (next: TextEditState | null) => void;
  getShapeById: (id: string) => TextShape | undefined;
  /** Called once per edit: with the text on commit, or null on cancel. */
  onFinish: (edit: TextEditState, text: string | null) => void;
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
  onFinish,
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
  // Enter or Escape unmounts the input, which can also fire blur.
  const finishedRef = useRef(false);
  const editingId = editingText?.id;

  useEffect(() => {
    finishedRef.current = false;
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const positioning = useMemo(() => {
    if (!editingText) return null;
    const container = containerRef.current;
    if (!container) return null;
    const shape = getShapeById(editingText.id);
    if (!shape) return null;

    // Viewport coordinates, the same mapping the pointer handlers use.
    const bounds = container.getBoundingClientRect();
    const centerX = bounds.left + bounds.width / 2;
    const centerY = bounds.top + bounds.height / 2;
    const stageTopLeftX = centerX - (canvasW * viewScale) / 2 + pan.x;
    const stageTopLeftY = centerY - (canvasH * viewScale) / 2 + pan.y;
    const px =
      stageTopLeftX + (shotX + (shape.x / natural.width) * shotW) * viewScale;
    const py =
      stageTopLeftY + (shotY + (shape.y / natural.height) * shotH) * viewScale;

    const fontPx = Math.max(12, shape.fontSize * viewScale);
    const fontFamily = shape.fontFamily ?? DEFAULT_FONT;
    const fontWeight = shape.fontWeight ?? 600;
    const box = measureFont(`${fontWeight} ${fontPx}px ${fontFamily}`, fontPx);
    return {
      left: px - BOX_LEFT,
      top: py - box.hangingTop - BOX_TOP,
      fontPx,
      fontFamily,
      fontWeight,
      lineHeight: box.lineHeight,
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

  const finish = (text: string | null) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    onFinish(editingText, text);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      aria-label="Edit text"
      value={editingText.value}
      onChange={(e) =>
        setEditingText({ ...editingText, value: e.target.value })
      }
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(editingText.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={() => finish(editingText.value)}
      className={styles.input}
      style={{
        left: positioning.left,
        top: positioning.top,
        fontSize: positioning.fontPx,
        fontFamily: positioning.fontFamily,
        fontWeight: positioning.fontWeight,
        lineHeight: `${positioning.lineHeight}px`,
      }}
    />
  );
}

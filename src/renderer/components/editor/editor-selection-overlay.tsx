import type React from 'react';
import type { MaskBox } from '../../hooks/pii/types';
import styles from './editor-selection-overlay.module.css';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface SelectionHandlesProps {
  bounds: MaskBox;
  strokeWidth: number;
  onResizeStart: (
    handle: ResizeHandle,
    event: React.PointerEvent<SVGRectElement>,
  ) => void;
  onDelete: () => void;
}

/** Dashed outline, corner resize handles and an inline delete button. */
export function SelectionHandles({
  bounds: b,
  strokeWidth,
  onResizeStart,
  onDelete,
}: SelectionHandlesProps) {
  const handleSize = Math.max(6, 6 + strokeWidth * 0.5);
  const pad = Math.max(4, strokeWidth);
  const handles: Array<{
    handle: ResizeHandle;
    x: number;
    y: number;
  }> = [
    {
      handle: 'nw',
      x: b.x - handleSize,
      y: b.y - handleSize,
    },
    {
      handle: 'ne',
      x: b.x + b.width,
      y: b.y - handleSize,
    },
    {
      handle: 'sw',
      x: b.x - handleSize,
      y: b.y + b.height,
    },
    {
      handle: 'se',
      x: b.x + b.width,
      y: b.y + b.height,
    },
  ];

  return (
    <g pointerEvents="none">
      <rect
        x={b.x - pad}
        y={b.y - pad}
        width={Math.max(1, b.width) + pad * 2}
        height={Math.max(1, b.height) + pad * 2}
        fill="none"
        className={styles.outline}
        strokeDasharray="4 2"
        strokeWidth={1}
      />
      {handles.map(({ handle, x, y }) => (
        <rect
          key={handle}
          x={x}
          y={y}
          width={handleSize}
          height={handleSize}
          className={`${styles.handle} ${styles[handle]}`}
          strokeWidth={1}
          rx={2}
          pointerEvents="all"
          onPointerDown={(ev) => {
            ev.stopPropagation();
            onResizeStart(handle, ev);
          }}
        />
      ))}
      <g
        pointerEvents="all"
        onPointerDown={(ev) => {
          ev.stopPropagation();
          onDelete();
        }}
        className={styles.delete}
      >
        <rect
          x={b.x + b.width + pad + 8}
          y={b.y - pad - 28}
          width={28}
          height={28}
          rx={8}
          className={styles.deleteButton}
        />
        <path
          d={`M ${b.x + b.width + pad + 16} ${b.y - pad - 16} l 8 8 M ${b.x + b.width + pad + 24} ${b.y - pad - 16} l -8 8`}
          className={styles.deleteIcon}
          strokeWidth={2}
          strokeLinecap="round"
        />
      </g>
    </g>
  );
}

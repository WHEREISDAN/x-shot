import type { MaskBox } from '../../hooks/pii/types';

export type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

interface SelectionHandlesProps {
  bounds: MaskBox;
  strokeWidth: number;
  onResizeStart: (handle: ResizeHandle) => void;
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
    cursor: string;
  }> = [
    {
      handle: 'nw',
      x: b.x - handleSize,
      y: b.y - handleSize,
      cursor: 'nwse-resize',
    },
    {
      handle: 'ne',
      x: b.x + b.width,
      y: b.y - handleSize,
      cursor: 'nesw-resize',
    },
    {
      handle: 'sw',
      x: b.x - handleSize,
      y: b.y + b.height,
      cursor: 'nesw-resize',
    },
    {
      handle: 'se',
      x: b.x + b.width,
      y: b.y + b.height,
      cursor: 'nwse-resize',
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
        stroke="#60a5fa"
        strokeDasharray="4 2"
        strokeWidth={1}
      />
      {handles.map(({ handle, x, y, cursor }) => (
        <rect
          key={handle}
          x={x}
          y={y}
          width={handleSize}
          height={handleSize}
          fill="#60a5fa"
          rx={2}
          pointerEvents="all"
          style={{ cursor }}
          onPointerDown={(ev) => {
            ev.stopPropagation();
            onResizeStart(handle);
          }}
        />
      ))}
      <g
        pointerEvents="all"
        onPointerDown={(ev) => {
          ev.stopPropagation();
          onDelete();
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
}

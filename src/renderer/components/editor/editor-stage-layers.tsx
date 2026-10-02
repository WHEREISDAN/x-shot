import React from 'react';
import type {
  ArrowShape,
  EllipseShape,
  PenShape,
  RectShape,
  TextShape,
  EditorShape,
} from '../../hooks/use-editor-state';

export function ArrowSvg({ a }: { a: ArrowShape }) {
  const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
  const headLen = Math.max(8, a.strokeWidth * 4);
  const hx1 = a.x2 - headLen * Math.cos(angle - Math.PI / 6);
  const hy1 = a.y2 - headLen * Math.sin(angle - Math.PI / 6);
  const hx2 = a.x2 - headLen * Math.cos(angle + Math.PI / 6);
  const hy2 = a.y2 - headLen * Math.sin(angle + Math.PI / 6);
  return (
    <g>
      <line
        x1={a.x1}
        y1={a.y1}
        x2={a.x2}
        y2={a.y2}
        stroke={a.strokeColor}
        strokeWidth={a.strokeWidth}
        strokeLinecap="round"
      />
      <line
        x1={a.x2}
        y1={a.y2}
        x2={hx1}
        y2={hy1}
        stroke={a.strokeColor}
        strokeWidth={a.strokeWidth}
        strokeLinecap="round"
      />
      <line
        x1={a.x2}
        y1={a.y2}
        x2={hx2}
        y2={hy2}
        stroke={a.strokeColor}
        strokeWidth={a.strokeWidth}
        strokeLinecap="round"
      />
    </g>
  );
}

export function ShapeSvg({
  shape,
  forcePiiRedaction = false,
}: {
  shape: EditorShape;
  forcePiiRedaction?: boolean;
}) {
  switch (shape.type) {
    case 'pen':
    case 'highlighter': {
      const p = shape as PenShape;
      const d = p.points
        .map((pt, idx) => `${idx === 0 ? 'M' : 'L'}${pt.x},${pt.y}`)
        .join(' ');
      return (
        <path
          d={d}
          fill="none"
          stroke={p.strokeColor}
          strokeWidth={p.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={p.type === 'highlighter' ? (p.opacity ?? 0.4) : 1}
        />
      );
    }
    case 'rect': {
      const r = shape as RectShape;
      const isPiiBlur = r.tag?.startsWith('pii-') && r.fillColor === '#808080';
      const isPiiShape = r.tag?.startsWith('pii-');

      if (forcePiiRedaction && isPiiShape) {
        return (
          <rect
            x={Math.min(r.x, r.x + r.width)}
            y={Math.min(r.y, r.y + r.height)}
            width={Math.abs(r.width)}
            height={Math.abs(r.height)}
            fill="#000000"
            fillOpacity={1}
            stroke="transparent"
            strokeWidth={0}
            rx={r.radius ?? 0}
            ry={r.radius ?? 0}
          />
        );
      }

      if (isPiiBlur) {
        const featherSize = 6;

        return (
          <foreignObject
            x={Math.min(r.x, r.x + r.width) - featherSize}
            y={Math.min(r.y, r.y + r.height) - featherSize}
            width={Math.abs(r.width) + featherSize * 2}
            height={Math.abs(r.height) + featherSize * 2}
          >
            <div
              style={{
                width: '100%',
                height: '100%',
                padding: `${featherSize}px`,
                boxSizing: 'border-box',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backdropFilter: 'blur(15px) saturate(1.2)',
                  WebkitBackdropFilter: 'blur(15px) saturate(1.2)',
                  background: 'rgba(255, 255, 255, 0.15)',
                  borderRadius: `${(r.radius ?? 0) + featherSize}px`,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  boxShadow: `
                    inset 0 0 20px rgba(255, 255, 255, 0.1),
                    0 0 ${featherSize * 3}px rgba(255, 255, 255, 0.3)
                  `,
                  // CSS mask for feathered edges
                  mask: `
                    radial-gradient(
                      ellipse 120% 120% at center,
                      black 75%,
                      transparent 100%
                    )
                  `,
                  WebkitMask: `
                    radial-gradient(
                      ellipse 120% 120% at center,
                      black 75%,
                      transparent 100%
                    )
                  `,
                  // Additional soft edge filter
                  filter: 'blur(1px)',
                }}
              />
            </div>
          </foreignObject>
        );
      }

      // Regular rectangle rendering
      return (
        <rect
          x={Math.min(r.x, r.x + r.width)}
          y={Math.min(r.y, r.y + r.height)}
          width={Math.abs(r.width)}
          height={Math.abs(r.height)}
          fill={r.fillColor ?? 'transparent'}
          fillOpacity={r.opacity ?? 1}
          stroke={r.strokeColor}
          strokeWidth={r.strokeWidth}
          rx={r.radius ?? 0}
          ry={r.radius ?? 0}
        />
      );
    }
    case 'ellipse': {
      const el = shape as EllipseShape;
      return (
        <ellipse
          cx={el.cx}
          cy={el.cy}
          rx={el.rx}
          ry={el.ry}
          fill={el.fillColor ?? 'transparent'}
          fillOpacity={el.opacity ?? 1}
          stroke={el.strokeColor}
          strokeWidth={el.strokeWidth}
        />
      );
    }
    case 'arrow':
      return <ArrowSvg a={shape as ArrowShape} />;
    case 'text': {
      const t = shape as TextShape;
      const width = (t.text?.length ?? 1) * (t.fontSize * 0.6);
      const height = t.fontSize * 1.2;
      return (
        <g>
          <rect
            x={t.x}
            y={t.y}
            width={Math.max(1, width)}
            height={height}
            fill="transparent"
            stroke="transparent"
            pointerEvents="all"
          />
          <text
            x={t.x}
            y={t.y}
            fill={t.strokeColor}
            fontSize={t.fontSize}
            fontWeight={t.fontWeight ?? 600}
            fontFamily={
              t.fontFamily ?? '-apple-system,BlinkMacSystemFont,Segoe UI,Roboto'
            }
            dominantBaseline="hanging"
            pointerEvents="none"
          >
            {t.text}
          </text>
        </g>
      );
    }
    default:
      return null;
  }
}

interface StageLayersProps {
  shapes: EditorShape[];
  piiMasks: RectShape[];
  provisionalShape: EditorShape | null;
  showOcrOverlay: boolean;
  ocrBoxes: Array<{ x: number; y: number; width: number; height: number }>;
  ocrKeyPrefix: string;
  isExporting: boolean;
  renderSelectionOverlay: (() => React.ReactNode) | undefined;
}

/** Annotations, then the PII layer on top so it always covers them. */
export function StageLayers({
  shapes,
  piiMasks,
  provisionalShape,
  showOcrOverlay,
  ocrBoxes,
  ocrKeyPrefix,
  isExporting,
  renderSelectionOverlay,
}: StageLayersProps) {
  return (
    <>
      {shapes.map((shape) => (
        <g key={shape.id}>
          <ShapeSvg shape={shape} forcePiiRedaction={isExporting} />
        </g>
      ))}
      <g data-pii-layer="">
        {piiMasks.map((mask) => (
          <g key={mask.id} data-pii-tag={mask.tag}>
            <ShapeSvg shape={mask} forcePiiRedaction={isExporting} />
          </g>
        ))}
      </g>
      {showOcrOverlay && !isExporting && (
        <g pointerEvents="none">
          {ocrBoxes.map((b) => (
            <rect
              key={`${ocrKeyPrefix}-${b.x}-${b.y}-${b.width}-${b.height}`}
              x={b.x}
              y={b.y}
              width={b.width}
              height={b.height}
              fill="transparent"
              stroke="rgba(255,255,255,0.35)"
              strokeDasharray="4 2"
              strokeWidth={1}
              rx={2}
            />
          ))}
        </g>
      )}
      {provisionalShape && (
        <ShapeSvg shape={provisionalShape} forcePiiRedaction={isExporting} />
      )}
      {!isExporting && renderSelectionOverlay?.()}
    </>
  );
}

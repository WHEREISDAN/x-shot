import type {
  EditorShape,
  RectShape,
  EllipseShape,
  ArrowShape,
  PenShape,
  TextShape,
} from '../../hooks/use-editor-state';

export function getBoundsForShape(shape: EditorShape): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  switch (shape.type) {
    case 'rect': {
      const r = shape as RectShape;
      const x1 = Math.min(r.x, r.x + r.width);
      const y1 = Math.min(r.y, r.y + r.height);
      const w = Math.abs(r.width);
      const h = Math.abs(r.height);
      return { x: x1, y: y1, width: w, height: h };
    }
    case 'ellipse': {
      const el = shape as EllipseShape;
      return {
        x: el.cx - el.rx,
        y: el.cy - el.ry,
        width: el.rx * 2,
        height: el.ry * 2,
      };
    }
    case 'arrow': {
      const a = shape as ArrowShape;
      const minX = Math.min(a.x1, a.x2);
      const minY = Math.min(a.y1, a.y2);
      const maxX = Math.max(a.x1, a.x2);
      const maxY = Math.max(a.y1, a.y2);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'pen':
    case 'highlighter': {
      const p = shape as PenShape;
      const xs = p.points.map((pt) => pt.x);
      const ys = p.points.map((pt) => pt.y);
      const minX = Math.min(...xs);
      const minY = Math.min(...ys);
      const maxX = Math.max(...xs);
      const maxY = Math.max(...ys);
      return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
    }
    case 'text': {
      const t = shape as TextShape;
      const width = (t.text?.length ?? 1) * (t.fontSize * 0.6);
      const height = t.fontSize * 1.2;
      return { x: t.x, y: t.y, width, height };
    }
    default:
      return { x: 0, y: 0, width: 0, height: 0 };
  }
}

export function hitTestPoint(
  x: number,
  y: number,
  shapes: EditorShape[],
): string | null {
  for (let i = shapes.length - 1; i >= 0; i -= 1) {
    const s = shapes[i];
    switch (s.type) {
      case 'rect': {
        const r = s as RectShape;
        const left = Math.min(r.x, r.x + r.width);
        const top = Math.min(r.y, r.y + r.height);
        const right = Math.max(r.x, r.x + r.width);
        const bottom = Math.max(r.y, r.y + r.height);
        if (x >= left && x <= right && y >= top && y <= bottom) return s.id;
        break;
      }
      case 'ellipse': {
        const el = s as EllipseShape;
        const dx = (x - el.cx) / (el.rx || 1);
        const dy = (y - el.cy) / (el.ry || 1);
        if (dx * dx + dy * dy <= 1) return s.id;
        break;
      }
      case 'arrow': {
        const a = s as ArrowShape;
        const dist = ((): number => {
          const vx = a.x2 - a.x1;
          const vy = a.y2 - a.y1;
          const wx = x - a.x1;
          const wy = y - a.y1;
          const c1 = vx * wx + vy * wy;
          if (c1 <= 0) return Math.hypot(x - a.x1, y - a.y1);
          const c2 = vx * vx + vy * vy;
          if (c2 <= c1) return Math.hypot(x - a.x2, y - a.y2);
          const b = c1 / c2;
          const px = a.x1 + b * vx;
          const py = a.y1 + b * vy;
          return Math.hypot(x - px, y - py);
        })();
        if (dist <= Math.max(6, s.strokeWidth * 1.5)) return s.id;
        break;
      }
      case 'pen':
      case 'highlighter': {
        const p = s as PenShape;
        const minX = Math.min(...p.points.map((pt) => pt.x));
        const minY = Math.min(...p.points.map((pt) => pt.y));
        const maxX = Math.max(...p.points.map((pt) => pt.x));
        const maxY = Math.max(...p.points.map((pt) => pt.y));
        if (x >= minX && x <= maxX && y >= minY && y <= maxY) return s.id;
        break;
      }
      case 'text': {
        const t = s as TextShape;
        const approxWidth = (t.text?.length ?? 1) * (t.fontSize * 0.6);
        const approxHeight = t.fontSize * 1.2;
        if (
          x >= t.x &&
          x <= t.x + approxWidth &&
          y >= t.y &&
          y <= t.y + approxHeight
        )
          return s.id;
        break;
      }
      default:
        break;
    }
  }
  return null;
}

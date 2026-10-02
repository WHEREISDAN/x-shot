import type { RectShape } from '../use-editor-state';
import type { MaskBox, PiiMask, PiiStyle } from './types';

// editor-stage renders a PII rect with this fill as a frosted blur.
const BLUR_FILL = '#808080';
const BLACK_FILL = '#000000';

/** Grows a detected text box so the blur fully covers the glyphs. */
export function styleDetectedBox(
  box: MaskBox,
  style: PiiStyle,
  image: { width: number; height: number },
): MaskBox {
  if (style !== 'blur') {
    return {
      x: Math.round(box.x),
      y: Math.round(box.y),
      width: Math.round(box.width),
      height: Math.round(box.height),
    };
  }
  const padding = Math.max(4, Math.min(box.width, box.height) * 0.15);
  const x = Math.max(0, Math.round(box.x - padding));
  const y = Math.max(0, Math.round(box.y - padding));
  return {
    x,
    y,
    width: Math.round(Math.min(box.width + padding * 2, image.width - x)),
    height: Math.round(Math.min(box.height + padding, image.height - y)),
  };
}

export function piiShapeStyle(
  style: PiiStyle,
): Pick<RectShape, 'fillColor' | 'opacity' | 'radius'> {
  return style === 'blur'
    ? { fillColor: BLUR_FILL, opacity: 0.8, radius: 4 }
    : { fillColor: BLACK_FILL, opacity: 1, radius: 2 };
}

export function maskToShape(mask: PiiMask, style: PiiStyle): RectShape {
  return {
    id: mask.id,
    type: 'rect',
    ...mask.rect,
    ...piiShapeStyle(style),
    strokeColor: 'transparent',
    strokeWidth: 0,
    tag: mask.tag,
  };
}

import type { PiiMaskRect } from './types';
import type { RectShape } from '../use-editor-state';

function applyMasksAsShapes(
  masks: PiiMaskRect[],
  defaultStyle: 'blur' | 'black',
  screenshot: { width: number; height: number },
  createRectForBox: (
    box: { x: number; y: number; width: number; height: number },
    options: {
      fillColor: string;
      strokeColor?: string;
      strokeWidth?: number;
      opacity?: number;
      radius?: number;
      tag?: string;
    },
  ) => RectShape,
) {
  if (!masks || masks.length === 0) return [] as RectShape[];

  const isBlur = defaultStyle === 'blur';
  const fillColor = isBlur ? '#808080' : '#000000';
  const opacity = isBlur ? 0.8 : 1;

  return masks.map((m) => {
    if (isBlur) {
      const padding = Math.max(4, Math.min(m.width, m.height) * 0.15);
      const expandedX = m.x - padding;
      const expandedY = m.y - padding;
      const expandedWidth = m.width + padding * 2;
      const expandedHeight = m.height + padding;
      const clampedX = Math.max(0, Math.round(expandedX));
      const clampedY = Math.max(0, Math.round(expandedY));
      const clampedWidth = Math.round(
        Math.min(expandedWidth, screenshot.width - clampedX),
      );
      const clampedHeight = Math.round(
        Math.min(expandedHeight, screenshot.height - clampedY),
      );
      return createRectForBox(
        {
          x: clampedX,
          y: clampedY,
          width: clampedWidth,
          height: clampedHeight,
        },
        {
          fillColor,
          strokeColor: 'transparent',
          strokeWidth: 0,
          opacity,
          radius: 4,
          tag: m.tag,
        },
      );
    }
    return createRectForBox(
      {
        x: Math.round(m.x),
        y: Math.round(m.y),
        width: Math.round(m.width),
        height: Math.round(m.height),
      },
      {
        fillColor,
        strokeColor: 'transparent',
        strokeWidth: 0,
        opacity,
        radius: 2,
        tag: m.tag,
      },
    );
  });
}

export default applyMasksAsShapes;

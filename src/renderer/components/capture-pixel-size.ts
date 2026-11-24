import {
  computeCropRect,
  type Rect,
  type Size,
} from '../../shared/crop-geometry';

/**
 * The size of the image a selection will produce, cropped the way main
 * crops it. The overlay covers one display, so its viewport is that
 * display; the snapshot holds the display's pixels. Without a snapshot,
 * main captures the display at its scale factor.
 */
export default function capturePixelSize(
  selection: Rect,
  viewport: Size,
  snapshot: Size | null,
  scaleFactor: number,
): Size | null {
  const pixels = snapshot ?? {
    width: Math.max(1, Math.round(viewport.width * scaleFactor)),
    height: Math.max(1, Math.round(viewport.height * scaleFactor)),
  };
  const crop = computeCropRect(selection, {
    ...pixels,
    bounds: { x: 0, y: 0, ...viewport },
  });
  return crop && { width: crop.width, height: crop.height };
}

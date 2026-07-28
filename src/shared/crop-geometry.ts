export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapshotGeometry {
  /** Snapshot image width in physical pixels. */
  width: number;
  /** Snapshot image height in physical pixels. */
  height: number;
  /** DIP bounds of the display the snapshot was captured from. */
  bounds: Rect;
}

/**
 * Converts a DIP-space selection into a pixel-space crop rect for a display
 * snapshot. Behavior-preserving extraction of the inline math previously in
 * the screenshot-data IPC handler; known defects (no lower clamp on
 * width/height, origin clamp shifting loss to the opposite edge, and
 * displayBounds/snapshot.bounds divergence) are intentionally retained and
 * documented by tests until later roadmap phases fix them.
 */
export function computeCropRect(
  selection: Rect,
  displayBounds: Rect,
  snapshot: SnapshotGeometry,
): Rect {
  const scaleX = snapshot.width / Math.max(1, snapshot.bounds.width);
  const scaleY = snapshot.height / Math.max(1, snapshot.bounds.height);
  const cropX = Math.max(
    0,
    Math.round((selection.x - displayBounds.x) * scaleX),
  );
  const cropY = Math.max(
    0,
    Math.round((selection.y - displayBounds.y) * scaleY),
  );
  const cropWidth = Math.round(selection.width * scaleX);
  const cropHeight = Math.round(selection.height * scaleY);

  return {
    x: cropX,
    y: cropY,
    width: Math.min(cropWidth, snapshot.width - cropX),
    height: Math.min(cropHeight, snapshot.height - cropY),
  };
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
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

export interface DisplayGeometry {
  id: number;
  /** DIP bounds in the global screen space; may be negative. */
  bounds: Rect;
  scaleFactor: number;
}

function intersect(a: Rect, b: Rect): Rect | null {
  const left = Math.max(a.x, b.x);
  const top = Math.max(a.y, b.y);
  const right = Math.min(a.x + a.width, b.x + b.width);
  const bottom = Math.min(a.y + a.height, b.y + b.height);
  if (right <= left || bottom <= top) return null;
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Converts a DIP selection into a pixel crop of the snapshot. The selection
 * is first clipped to the snapshot's own display, so whatever overflows is
 * trimmed from the edge that overflows. Returns null when nothing of the
 * selection lies on that display.
 */
export function computeCropRect(
  selection: Rect,
  snapshot: SnapshotGeometry,
): Rect | null {
  const visible = intersect(selection, snapshot.bounds);
  if (!visible) return null;

  const scaleX = snapshot.width / Math.max(1, snapshot.bounds.width);
  const scaleY = snapshot.height / Math.max(1, snapshot.bounds.height);
  const x = Math.round((visible.x - snapshot.bounds.x) * scaleX);
  const y = Math.round((visible.y - snapshot.bounds.y) * scaleY);
  const width = Math.min(
    Math.round(visible.width * scaleX),
    snapshot.width - x,
  );
  const height = Math.min(
    Math.round(visible.height * scaleY),
    snapshot.height - y,
  );
  if (width < 1 || height < 1) return null;
  return { x, y, width, height };
}

/** A display's size in physical pixels. */
export function physicalSize(display: DisplayGeometry): Size {
  const scale = display.scaleFactor || 1;
  return {
    width: Math.max(1, Math.round(display.bounds.width * scale)),
    height: Math.max(1, Math.round(display.bounds.height * scale)),
  };
}

/**
 * Groups displays that share a physical size. desktopCapturer scales every
 * screen to one requested size per call, so one call per group returns each
 * display at its native resolution.
 */
export function groupByPhysicalSize(
  displays: DisplayGeometry[],
): Array<{ size: Size; displayIds: number[] }> {
  return displays.reduce<Array<{ size: Size; displayIds: number[] }>>(
    (groups, display) => {
      const size = physicalSize(display);
      const group = groups.find(
        (g) => g.size.width === size.width && g.size.height === size.height,
      );
      if (group) {
        group.displayIds.push(display.id);
        return groups;
      }
      return [...groups, { size, displayIds: [display.id] }];
    },
    [],
  );
}

/**
 * The display a selection was made on: the one the overlay reported, or,
 * without that, the display the selection overlaps most.
 */
export function displayForSelection<T extends DisplayGeometry>(
  displays: T[],
  selection: Rect & { displayId?: number },
): T | null {
  const reported = displays.find((d) => d.id === selection.displayId);
  if (reported) return reported;
  const overlap = (d: T) => {
    const area = intersect(selection, d.bounds);
    return area ? area.width * area.height : 0;
  };
  return displays.reduce<T | null>(
    (best, d) => (!best || overlap(d) > overlap(best) ? d : best),
    null,
  );
}

/** Clips a rect to the viewport (0,0)-(width,height); may shrink it. */
export function clampToViewport(rect: Rect, viewport: Size): Rect {
  const x = Math.min(Math.max(0, rect.x), viewport.width);
  const y = Math.min(Math.max(0, rect.y), viewport.height);
  const right = Math.min(Math.max(x, rect.x + rect.width), viewport.width);
  const bottom = Math.min(Math.max(y, rect.y + rect.height), viewport.height);
  return { x, y, width: right - x, height: bottom - y };
}

/** Moves a rect back inside the viewport without changing its size. */
export function keepInViewport(rect: Rect, viewport: Size): Rect {
  const width = Math.min(rect.width, viewport.width);
  const height = Math.min(rect.height, viewport.height);
  return {
    x: Math.min(Math.max(0, rect.x), viewport.width - width),
    y: Math.min(Math.max(0, rect.y), viewport.height - height),
    width,
    height,
  };
}

import { desktopCapturer, screen } from 'electron';
import type {
  DesktopCapturerSource,
  Display,
  NativeImage,
  Rectangle,
} from 'electron';
import log from 'electron-log';
import type { GetDisplaySnapshotResponse } from '../shared/ipc-types';
import { groupByPhysicalSize, physicalSize } from '../shared/crop-geometry';
import { markCaptureStage } from './capture-diagnostics';
import { captureAssets } from './capture-assets';

export interface DisplaySnapshot {
  image: NativeImage;
  /** The snapshot in the asset store, for the overlay's background. */
  assetId: string;
  width: number;
  height: number;
  bounds: Rectangle;
  scaleFactor: number;
  sourceId?: string;
}

// Snapshots live exactly as long as one capture session: taken when the
// overlays open, released when the session ends.
const displaySnapshots = new Map<number, DisplaySnapshot>();

export function releaseDisplaySnapshots(): void {
  if (displaySnapshots.size === 0) return;
  log.info(`Releasing ${displaySnapshots.size} display snapshots from memory`);
  const assetIds = new Set(
    Array.from(displaySnapshots.values(), (snap) => snap.assetId),
  );
  captureAssets.releaseWhere((asset) => assetIds.has(asset.assetId));
  displaySnapshots.clear();
}

export function getDisplaySnapshot(
  displayId: number,
): DisplaySnapshot | undefined {
  return displaySnapshots.get(displayId);
}

/** The screen source of a display: by id, else the closest aspect ratio. */
export function pickSourceForDisplay(
  sources: DesktopCapturerSource[],
  display: Display,
): DesktopCapturerSource | undefined {
  const direct = sources.find((s) => s.display_id === String(display.id));
  if (direct || sources.length <= 1) return direct ?? sources[0];
  const target = physicalSize(display);
  const targetRatio = target.width / target.height;
  const ratioDelta = (s: DesktopCapturerSource) => {
    const size = s.thumbnail.getSize();
    return size.width > 0 && size.height > 0
      ? Math.abs(size.width / size.height - targetRatio)
      : Number.POSITIVE_INFINITY;
  };
  return sources.reduce((best, s) =>
    ratioDelta(s) < ratioDelta(best) ? s : best,
  );
}

function storeSnapshot(
  sessionId: string,
  display: Display,
  source: DesktopCapturerSource,
): DisplaySnapshot {
  const image = source.thumbnail;
  const { width, height } = image.getSize();
  const scaleFactor = display.scaleFactor || 1;
  // Encoded only when an overlay asks for it.
  const asset = captureAssets.add({
    sessionId,
    kind: 'snapshot',
    width,
    height,
    scaleFactor,
    encode: () => image.toPNG(),
  });
  return {
    image,
    assetId: asset.assetId,
    width,
    height,
    bounds: display.bounds,
    scaleFactor,
    sourceId: source.id,
  };
}

/** Captures every display once, each at its native physical size. */
export async function prepareDisplaySnapshots(
  sessionId: string,
): Promise<void> {
  releaseDisplaySnapshots();
  const displays = screen.getAllDisplays();
  try {
    // getSources scales every screen to one size per call, so displays
    // are captured in groups that share a physical size.
    await groupByPhysicalSize(displays).reduce(async (previous, group) => {
      await previous;
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: group.size,
      });
      group.displayIds.forEach((id) => {
        const display = displays.find((d) => d.id === id);
        const source = display && pickSourceForDisplay(sources, display);
        if (!display || !source || source.thumbnail.isEmpty()) {
          log.warn(`Pre-capture: no screen source for display ${id}`);
          return;
        }
        const snapshot = storeSnapshot(sessionId, display, source);
        displaySnapshots.set(id, snapshot);
        log.info(
          `Pre-capture: stored snapshot for display ${id} -> ${snapshot.width}x${snapshot.height}`,
        );
      });
    }, Promise.resolve());

    markCaptureStage('snapshot-ready', {
      displays: Array.from(displaySnapshots.entries()).map(
        ([displayId, snap]) => ({
          displayId,
          bounds: snap.bounds,
          scaleFactor: snap.scaleFactor,
          sourceId: snap.sourceId,
          frameWidth: snap.width,
          frameHeight: snap.height,
        }),
      ),
    });
  } catch (err) {
    log.error('Failed to prepare display snapshots:', err);
    releaseDisplaySnapshots();
  }
}

/**
 * The overlay background for a display: its own snapshot, else the one
 * closest in aspect ratio.
 */
export function overlaySnapshotFor(
  displayId: number,
): GetDisplaySnapshotResponse | null {
  const display = screen.getAllDisplays().find((d) => d.id === displayId);
  const own = displaySnapshots.get(displayId);
  const closest = (): DisplaySnapshot | undefined => {
    if (!display) return undefined;
    const target = physicalSize(display);
    const ratio = (s: { width: number; height: number }) =>
      s.height > 0 ? s.width / s.height : 0;
    const delta = (s: DisplaySnapshot) => Math.abs(ratio(s) - ratio(target));
    return Array.from(displaySnapshots.values()).reduce<
      DisplaySnapshot | undefined
    >((best, s) => (!best || delta(s) < delta(best) ? s : best), undefined);
  };
  const snap = own ?? closest();
  if (!snap) return null;
  return { assetId: snap.assetId, width: snap.width, height: snap.height };
}

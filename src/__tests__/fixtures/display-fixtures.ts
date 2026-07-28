import type { Rect, SnapshotGeometry } from '../../shared/crop-geometry';

export interface DisplayFixture {
  name: string;
  displays: Array<{ id: number; bounds: Rect; scaleFactor: number }>;
  /** Keyed by display id; geometry of the pre-captured snapshot. */
  snapshots: Record<number, SnapshotGeometry>;
}

const dip = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});

export const landscape1080p: DisplayFixture = {
  name: 'single 1920x1080 display at 1x',
  displays: [{ id: 1, bounds: dip(0, 0, 1920, 1080), scaleFactor: 1 }],
  snapshots: {
    1: { width: 1920, height: 1080, bounds: dip(0, 0, 1920, 1080) },
  },
};

export const retina2x: DisplayFixture = {
  name: 'single Retina/HiDPI display at 2x',
  displays: [{ id: 1, bounds: dip(0, 0, 1728, 1117), scaleFactor: 2 }],
  snapshots: {
    1: { width: 3456, height: 2234, bounds: dip(0, 0, 1728, 1117) },
  },
};

export const mixedScaleFactors: DisplayFixture = {
  name: 'two displays with different scale factors',
  displays: [
    { id: 1, bounds: dip(0, 0, 1920, 1080), scaleFactor: 1 },
    { id: 2, bounds: dip(1920, 0, 1728, 1117), scaleFactor: 2 },
  ],
  snapshots: {
    1: { width: 1920, height: 1080, bounds: dip(0, 0, 1920, 1080) },
    2: { width: 3456, height: 2234, bounds: dip(1920, 0, 1728, 1117) },
  },
};

export const secondaryLeftOfPrimary: DisplayFixture = {
  name: 'secondary display positioned left of the primary display',
  displays: [
    { id: 1, bounds: dip(0, 0, 1920, 1080), scaleFactor: 1 },
    { id: 2, bounds: dip(-1920, 0, 1920, 1080), scaleFactor: 1 },
  ],
  snapshots: {
    1: { width: 1920, height: 1080, bounds: dip(0, 0, 1920, 1080) },
    2: { width: 1920, height: 1080, bounds: dip(-1920, 0, 1920, 1080) },
  },
};

export const secondaryAbovePrimary: DisplayFixture = {
  name: 'secondary display positioned above the primary display',
  displays: [
    { id: 1, bounds: dip(0, 0, 1920, 1080), scaleFactor: 1 },
    { id: 2, bounds: dip(0, -1080, 1920, 1080), scaleFactor: 1 },
  ],
  snapshots: {
    1: { width: 1920, height: 1080, bounds: dip(0, 0, 1920, 1080) },
    2: { width: 1920, height: 1080, bounds: dip(0, -1080, 1920, 1080) },
  },
};

/**
 * A 5K display is 5120x2880 physical pixels, but desktopCapturer thumbnails
 * are clamped to MAX_SNAPSHOT_DIMENSION (4096), so the stored snapshot is
 * 4096x2304 and the effective scale is 1.6x rather than the display's 2x.
 */
export const fiveK: DisplayFixture = {
  name: '5K display at 2x (snapshot clamped to 4096)',
  displays: [{ id: 1, bounds: dip(0, 0, 2560, 1440), scaleFactor: 2 }],
  snapshots: {
    1: { width: 4096, height: 2304, bounds: dip(0, 0, 2560, 1440) },
  },
};

export const rotatedPortrait: DisplayFixture = {
  name: 'rotated portrait display at 2x',
  displays: [{ id: 1, bounds: dip(0, 0, 1117, 1728), scaleFactor: 2 }],
  snapshots: {
    1: { width: 2234, height: 3456, bounds: dip(0, 0, 1117, 1728) },
  },
};

export const allFixtures: DisplayFixture[] = [
  landscape1080p,
  retina2x,
  mixedScaleFactors,
  secondaryLeftOfPrimary,
  secondaryAbovePrimary,
  fiveK,
  rotatedPortrait,
];

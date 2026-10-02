/**
 * @jest-environment node
 */
import {
  clampToViewport,
  computeCropRect,
  displayForSelection,
  groupByPhysicalSize,
  keepInViewport,
  physicalSize,
} from '../shared/crop-geometry';
import {
  landscape1080p,
  retina2x,
  mixedScaleFactors,
  secondaryLeftOfPrimary,
  secondaryAbovePrimary,
  fiveK,
  rotatedPortrait,
} from './fixtures/display-fixtures';

describe('computeCropRect', () => {
  it('is the identity on a 1920x1080 display at 1x', () => {
    expect(
      computeCropRect(
        { x: 100, y: 100, width: 400, height: 300 },
        landscape1080p.snapshots[1],
      ),
    ).toEqual({ x: 100, y: 100, width: 400, height: 300 });
  });

  it('doubles all coordinates on a Retina display at 2x', () => {
    expect(
      computeCropRect(
        { x: 100, y: 100, width: 400, height: 300 },
        retina2x.snapshots[1],
      ),
    ).toEqual({ x: 200, y: 200, width: 800, height: 600 });
  });

  it('uses the selected display scale in a mixed-DPI setup', () => {
    expect(
      computeCropRect(
        { x: 2000, y: 100, width: 400, height: 300 },
        mixedScaleFactors.snapshots[2],
      ),
    ).toEqual({ x: 160, y: 200, width: 800, height: 600 });
  });

  it('offsets correctly on a secondary display left of the primary', () => {
    expect(
      computeCropRect(
        { x: -1800, y: 100, width: 400, height: 300 },
        secondaryLeftOfPrimary.snapshots[2],
      ),
    ).toEqual({ x: 120, y: 100, width: 400, height: 300 });
  });

  it('trims the part of a selection that starts off the display to the left', () => {
    // -2000..-1600 on a display spanning -1920..0 keeps -1920..-1600.
    expect(
      computeCropRect(
        { x: -2000, y: 100, width: 400, height: 300 },
        secondaryLeftOfPrimary.snapshots[2],
      ),
    ).toEqual({ x: 0, y: 100, width: 320, height: 300 });
  });

  it('offsets correctly on a secondary display above the primary', () => {
    expect(
      computeCropRect(
        { x: 100, y: -1000, width: 400, height: 300 },
        secondaryAbovePrimary.snapshots[2],
      ),
    ).toEqual({ x: 100, y: 80, width: 400, height: 300 });
  });

  it('trims a selection that starts above a display above the primary', () => {
    expect(
      computeCropRect(
        { x: 100, y: -1180, width: 400, height: 300 },
        secondaryAbovePrimary.snapshots[2],
      ),
    ).toEqual({ x: 100, y: 0, width: 400, height: 200 });
  });

  it('keeps native resolution on a 5K display', () => {
    expect(
      computeCropRect(
        { x: 0, y: 0, width: 2560, height: 1440 },
        fiveK.snapshots[1],
      ),
    ).toEqual({ x: 0, y: 0, width: 5120, height: 2880 });
  });

  it('handles a rotated portrait display at 2x', () => {
    expect(
      computeCropRect(
        { x: 100, y: 200, width: 300, height: 500 },
        rotatedPortrait.snapshots[1],
      ),
    ).toEqual({ x: 200, y: 400, width: 600, height: 1000 });
  });

  it('clamps width and height when the selection overflows right/bottom', () => {
    expect(
      computeCropRect(
        { x: 1800, y: 1000, width: 400, height: 300 },
        landscape1080p.snapshots[1],
      ),
    ).toEqual({ x: 1800, y: 1000, width: 120, height: 80 });
  });

  it('refuses a selection fully outside the display', () => {
    expect(
      computeCropRect(
        { x: 2000, y: 100, width: 400, height: 300 },
        landscape1080p.snapshots[1],
      ),
    ).toBeNull();
  });

  it('refuses empty, zero and negative selections', () => {
    const snapshot = landscape1080p.snapshots[1];
    expect(
      computeCropRect({ x: 10, y: 10, width: 0, height: 0 }, snapshot),
    ).toBeNull();
    expect(
      computeCropRect({ x: 10, y: 10, width: 300, height: 0 }, snapshot),
    ).toBeNull();
    expect(
      computeCropRect({ x: 10, y: 10, width: -50, height: 40 }, snapshot),
    ).toBeNull();
  });

  it("crops only from the snapshot's own display", () => {
    // The snapshot belongs to the right-hand display; a selection on the
    // left-hand display must not be cropped from it at another scale.
    const crop = computeCropRect(
      { x: 100, y: 100, width: 400, height: 300 },
      {
        width: 3456,
        height: 2234,
        bounds: { x: 1920, y: 0, width: 1728, height: 1117 },
      },
    );
    expect(crop).toBeNull();
  });
});

describe('physical sizes', () => {
  it('converts DIP bounds with the scale factor', () => {
    expect(physicalSize(fiveK.displays[0])).toEqual({
      width: 5120,
      height: 2880,
    });
    expect(physicalSize(retina2x.displays[0])).toEqual({
      width: 3456,
      height: 2234,
    });
  });

  it('requests one snapshot size per distinct physical size', () => {
    expect(groupByPhysicalSize(mixedScaleFactors.displays)).toEqual([
      { size: { width: 1920, height: 1080 }, displayIds: [1] },
      { size: { width: 3456, height: 2234 }, displayIds: [2] },
    ]);
    expect(groupByPhysicalSize(secondaryLeftOfPrimary.displays)).toEqual([
      { size: { width: 1920, height: 1080 }, displayIds: [1, 2] },
    ]);
  });
});

describe('displayForSelection', () => {
  const { displays } = secondaryLeftOfPrimary;

  it('uses the display the overlay reported', () => {
    // Overlapping both displays, but drawn on the left-hand one.
    const selection = { x: -100, y: 0, width: 400, height: 200, displayId: 2 };
    expect(displayForSelection(displays, selection)?.id).toBe(2);
  });

  it('falls back to the display with the largest overlap', () => {
    expect(
      displayForSelection(displays, { x: -100, y: 0, width: 400, height: 200 })
        ?.id,
    ).toBe(1);
    expect(
      displayForSelection(displays, {
        x: -100,
        y: 0,
        width: 400,
        height: 200,
        displayId: 99,
      })?.id,
    ).toBe(1);
  });
});

describe('viewport clamping', () => {
  const viewport = { width: 1920, height: 1080 };

  it('clips a selection to the overlay', () => {
    expect(
      clampToViewport({ x: -40, y: 1000, width: 200, height: 200 }, viewport),
    ).toEqual({ x: 0, y: 1000, width: 160, height: 80 });
  });

  it('moves a dragged selection back inside without resizing it', () => {
    expect(
      keepInViewport({ x: 1850, y: -30, width: 400, height: 300 }, viewport),
    ).toEqual({ x: 1520, y: 0, width: 400, height: 300 });
  });
});

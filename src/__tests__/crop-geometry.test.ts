/**
 * @jest-environment node
 */
import { computeCropRect } from '../shared/crop-geometry';
import {
  landscape1080p,
  retina2x,
  mixedScaleFactors,
  secondaryLeftOfPrimary,
  secondaryAbovePrimary,
  fiveK,
  rotatedPortrait,
} from './fixtures/display-fixtures';

/**
 * These tests document the CURRENT behavior of the DIP-to-pixel crop
 * conversion, including known defects that later roadmap phases fix.
 * Assertions marked KNOWN-DEFECT must be updated when the fix lands.
 */
describe('computeCropRect', () => {
  it('is the identity on a 1920x1080 display at 1x', () => {
    const display = landscape1080p.displays[0];
    const crop = computeCropRect(
      { x: 100, y: 100, width: 400, height: 300 },
      display.bounds,
      landscape1080p.snapshots[1],
    );
    expect(crop).toEqual({ x: 100, y: 100, width: 400, height: 300 });
  });

  it('doubles all coordinates on a Retina display at 2x', () => {
    const display = retina2x.displays[0];
    const crop = computeCropRect(
      { x: 100, y: 100, width: 400, height: 300 },
      display.bounds,
      retina2x.snapshots[1],
    );
    expect(crop).toEqual({ x: 200, y: 200, width: 800, height: 600 });
  });

  it('uses the selected display scale in a mixed-DPI setup', () => {
    const secondary = mixedScaleFactors.displays[1];
    const crop = computeCropRect(
      { x: 2000, y: 100, width: 400, height: 300 },
      secondary.bounds,
      mixedScaleFactors.snapshots[2],
    );
    expect(crop).toEqual({ x: 160, y: 200, width: 800, height: 600 });
  });

  it('offsets correctly on a secondary display left of the primary', () => {
    const secondary = secondaryLeftOfPrimary.displays[1];
    const crop = computeCropRect(
      { x: -1800, y: 100, width: 400, height: 300 },
      secondary.bounds,
      secondaryLeftOfPrimary.snapshots[2],
    );
    expect(crop).toEqual({ x: 120, y: 100, width: 400, height: 300 });
  });

  // KNOWN-DEFECT(phase-2): when a selection starts left of the display,
  // cropX clamps to 0 but the width is not reduced, so the excess is
  // included from the right edge instead of trimmed from the left.
  it('shifts loss to the wrong edge when the selection starts off-screen left', () => {
    const secondary = secondaryLeftOfPrimary.displays[1];
    const crop = computeCropRect(
      { x: -2000, y: 100, width: 400, height: 300 },
      secondary.bounds,
      secondaryLeftOfPrimary.snapshots[2],
    );
    expect(crop).toEqual({ x: 0, y: 100, width: 400, height: 300 });
  });

  it('offsets correctly on a secondary display above the primary', () => {
    const secondary = secondaryAbovePrimary.displays[1];
    const crop = computeCropRect(
      { x: 100, y: -1000, width: 400, height: 300 },
      secondary.bounds,
      secondaryAbovePrimary.snapshots[2],
    );
    expect(crop).toEqual({ x: 100, y: 80, width: 400, height: 300 });
  });

  // KNOWN-DEFECT(phase-3): desktopCapturer thumbnails are clamped to 4096px,
  // so a 5K display's snapshot is 4096x2304 and the effective scale is 1.6x
  // rather than the display's true 2x. A full-display selection therefore
  // yields 4096x2304 instead of the physical 5120x2880.
  it('produces a resolution-limited crop on a 5K display', () => {
    const display = fiveK.displays[0];
    const crop = computeCropRect(
      { x: 0, y: 0, width: 2560, height: 1440 },
      display.bounds,
      fiveK.snapshots[1],
    );
    expect(crop).toEqual({ x: 0, y: 0, width: 4096, height: 2304 });
  });

  it('handles a rotated portrait display at 2x', () => {
    const display = rotatedPortrait.displays[0];
    const crop = computeCropRect(
      { x: 100, y: 200, width: 300, height: 500 },
      display.bounds,
      rotatedPortrait.snapshots[1],
    );
    expect(crop).toEqual({ x: 200, y: 400, width: 600, height: 1000 });
  });

  it('clamps width and height when the selection overflows right/bottom', () => {
    const display = landscape1080p.displays[0];
    const crop = computeCropRect(
      { x: 1800, y: 1000, width: 400, height: 300 },
      display.bounds,
      landscape1080p.snapshots[1],
    );
    expect(crop).toEqual({ x: 1800, y: 1000, width: 120, height: 80 });
  });

  // KNOWN-DEFECT(phase-2): there is no lower clamp on width/height, so a
  // selection entirely outside the display produces a negative width that
  // downstream nativeImage.crop() cannot use.
  it('produces a negative width for a selection fully outside the display', () => {
    const display = landscape1080p.displays[0];
    const crop = computeCropRect(
      { x: 2000, y: 100, width: 400, height: 300 },
      display.bounds,
      landscape1080p.snapshots[1],
    );
    expect(crop).toEqual({ x: 2000, y: 100, width: -80, height: 300 });
  });

  // KNOWN-DEFECT(phase-2/3): the scale comes from snapshot.bounds while the
  // origin offset comes from displayBounds. When the aspect-ratio source
  // fallback binds a snapshot from a different display, the two diverge and
  // the crop is scaled by the wrong display's factor.
  it('skews the crop when displayBounds and snapshot.bounds diverge', () => {
    const crop = computeCropRect(
      { x: 100, y: 100, width: 400, height: 300 },
      { x: 0, y: 0, width: 1920, height: 1080 },
      {
        width: 3456,
        height: 2234,
        bounds: { x: 1920, y: 0, width: 1728, height: 1117 },
      },
    );
    expect(crop).toEqual({ x: 200, y: 200, width: 800, height: 600 });
  });
});

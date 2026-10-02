import {
  applyOverrides,
  autoMaskId,
  findMaskAt,
  isDrawableMask,
  isManualMaskId,
  manualMaskId,
  normalizeBox,
} from '../renderer/hooks/pii/mask-layer';
import {
  maskToShape,
  styleDetectedBox,
} from '../renderer/hooks/pii/apply-masks';
import removeLegacyPiiMaskKeys from '../renderer/hooks/pii/legacy-mask-storage';
import type { PiiMask } from '../renderer/hooks/pii/types';

const mask = (id: string, x: number, y: number): PiiMask => ({
  id,
  source: 'auto',
  tag: 'pii-email',
  rect: { x, y, width: 100, height: 20 },
});

describe('PII mask layer helpers', () => {
  it('derives a stable id from the detection', () => {
    const detection = {
      tag: 'pii-email',
      x: 10.4,
      y: 20,
      width: 99.6,
      height: 20,
    };
    expect(autoMaskId(detection)).toBe('auto:pii-email:10,20,100,20');
    expect(autoMaskId({ ...detection })).toBe(autoMaskId(detection));
    expect(isManualMaskId(manualMaskId(3))).toBe(true);
    expect(isManualMaskId(autoMaskId(detection))).toBe(false);
  });

  it('applies deletions and moves to auto masks', () => {
    const masks = [mask('a', 0, 0), mask('b', 0, 50)];
    expect(
      applyOverrides(masks, {
        a: { deleted: true },
        b: { rect: { x: 5, y: 55, width: 10, height: 10 } },
      }),
    ).toEqual([{ ...masks[1], rect: { x: 5, y: 55, width: 10, height: 10 } }]);
  });

  it('hit tests the topmost mask', () => {
    const masks = [mask('below', 0, 0), mask('above', 50, 0)];
    expect(findMaskAt(masks, 60, 10)).toBe('above');
    expect(findMaskAt(masks, 10, 10)).toBe('below');
    expect(findMaskAt(masks, 500, 500)).toBeNull();
  });

  it('normalizes dragged boxes and rejects tiny ones', () => {
    expect(normalizeBox({ x: 50, y: 40, width: -20, height: -10 })).toEqual({
      x: 30,
      y: 30,
      width: 20,
      height: 10,
    });
    expect(isDrawableMask({ x: 0, y: 0, width: 1, height: 30 })).toBe(false);
    expect(isDrawableMask({ x: 0, y: 0, width: -5, height: 5 })).toBe(true);
  });

  it('pads blur masks inside the image and renders masks as PII rects', () => {
    const image = { width: 200, height: 100 };
    expect(
      styleDetectedBox({ x: 2, y: 2, width: 100, height: 20 }, 'blur', image),
    ).toEqual({ x: 0, y: 0, width: 108, height: 24 });
    expect(
      styleDetectedBox(
        { x: 2.4, y: 2, width: 100, height: 20 },
        'black',
        image,
      ),
    ).toEqual({ x: 2, y: 2, width: 100, height: 20 });

    const shape = maskToShape(mask('m', 1, 2), 'black');
    expect(shape).toMatchObject({
      id: 'm',
      type: 'rect',
      x: 1,
      y: 2,
      fillColor: '#000000',
      tag: 'pii-email',
    });
  });

  it('removes only the legacy saved-mask keys', () => {
    localStorage.setItem('pii-masks:10x10:abc', '[]');
    localStorage.setItem('keep-me', '1');

    expect(removeLegacyPiiMaskKeys()).toBe(1);
    expect(localStorage.getItem('pii-masks:10x10:abc')).toBeNull();
    expect(localStorage.getItem('keep-me')).toBe('1');
    localStorage.clear();
  });
});

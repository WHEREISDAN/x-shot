import { computeFitScale } from '../renderer/hooks/use-fit-scale';

const MARGIN = 16;
const canvas = { width: 1206, height: 626 };

describe('computeFitScale', () => {
  it('fits the width when the stage is wide', () => {
    const scale = computeFitScale({
      area: { width: 1024, height: 2000 },
      canvas,
    });
    expect(scale).toBeCloseTo((1024 - 2 * MARGIN) / 1206);
  });

  it('fits the height when the free area is short', () => {
    const area = { width: 3000, height: 400 };
    const scale = computeFitScale({ area, canvas });

    expect(scale).toBeCloseTo((400 - 2 * MARGIN) / 626);
    expect(canvas.height * scale).toBeLessThanOrEqual(
      area.height - 2 * MARGIN + 0.001,
    );
  });

  it('never enlarges past 1.1 or shrinks below 0.05', () => {
    expect(
      computeFitScale({
        area: { width: 3000, height: 2000 },
        canvas: { width: 100, height: 100 },
      }),
    ).toBe(1.1);
    expect(computeFitScale({ area: { width: 0, height: 0 }, canvas })).toBe(
      0.05,
    );
  });
});

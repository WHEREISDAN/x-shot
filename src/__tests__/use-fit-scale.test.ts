import { computeFitScale } from '../renderer/hooks/use-fit-scale';

const MARGIN = 16;
const container = { top: 100, bottom: 600, width: 1024 };
const canvas = { width: 1206, height: 626 };

/** Bottom edge of the stage, centered in the container, at `scale`. */
const stageBottom = (scale: number) =>
  (container.top + container.bottom) / 2 + (canvas.height * scale) / 2;

describe('computeFitScale', () => {
  it('fits the width when the stage is wide and nothing is below', () => {
    const scale = computeFitScale({
      container: { ...container, bottom: 1100 },
      toolbarTop: null,
      canvas,
    });
    expect(scale).toBeCloseTo((1024 - 2 * MARGIN) / 1206);
  });

  it('keeps the stage above a wrapped toolbar', () => {
    const toolbarTop = 470;
    const scale = computeFitScale({ container, toolbarTop, canvas });

    expect(stageBottom(scale)).toBeLessThanOrEqual(toolbarTop - MARGIN + 0.001);
    expect(scale).toBeLessThan(
      computeFitScale({ container, toolbarTop: null, canvas }),
    );
  });

  it('never enlarges past 1.1 or shrinks below 0.05', () => {
    expect(
      computeFitScale({
        container: { top: 0, bottom: 2000, width: 3000 },
        toolbarTop: null,
        canvas: { width: 100, height: 100 },
      }),
    ).toBe(1.1);
    expect(
      computeFitScale({ container, toolbarTop: container.top, canvas }),
    ).toBe(0.05);
  });
});

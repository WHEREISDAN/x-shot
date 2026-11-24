import { useEffect, useState, type RefObject } from 'react';

const FIT_MARGIN = 16;
const MAX_FIT_SCALE = 1.1;
const MIN_FIT_SCALE = 0.05;

export interface FitInput {
  /**
   * The free area the stage is centred in: the canvas left of the
   * Presentation panel, below the top islands and above the tool dock.
   */
  area: { width: number; height: number };
  canvas: { width: number; height: number };
}

/**
 * The largest scale that keeps the centred stage inside the free area, so
 * at the fitted zoom no island, panel or dock covers the capture.
 */
export function computeFitScale({ area, canvas }: FitInput): number {
  const maxWidth = Math.max(1, area.width - 2 * FIT_MARGIN);
  const maxHeight = Math.max(1, area.height - 2 * FIT_MARGIN);
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  return Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, scale));
}

/** Recomputes the fit whenever the window or the free area resizes. */
export function useFitScale(
  areaRef: RefObject<HTMLElement | null>,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const area = areaRef.current;
      if (!area) return;
      const rect = area.getBoundingClientRect();
      setFitScale(
        computeFitScale({
          area: { width: rect.width, height: rect.height },
          canvas: { width: canvasWidth, height: canvasHeight },
        }),
      );
    };
    update();
    window.addEventListener('resize', update);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    if (areaRef.current) observer?.observe(areaRef.current);
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [areaRef, canvasWidth, canvasHeight]);

  return fitScale;
}

import { useEffect, useState, type RefObject } from 'react';

const FIT_MARGIN = 16;
const MAX_FIT_SCALE = 1.1;
const MIN_FIT_SCALE = 0.05;

export interface FitInput {
  /** The stage container in viewport pixels. */
  container: { top: number; bottom: number; width: number };
  /** Viewport y of the bottom toolbar's top edge, if it is rendered. */
  toolbarTop: number | null;
  canvas: { width: number; height: number };
}

/**
 * The largest scale that keeps the centered stage inside its container and
 * clear of the floating bottom toolbar, however many rows the toolbar wraps
 * onto.
 */
export function computeFitScale({
  container,
  toolbarTop,
  canvas,
}: FitInput): number {
  const centerY = (container.top + container.bottom) / 2;
  const bottomLimit = Math.min(
    container.bottom,
    toolbarTop ?? container.bottom,
  );
  // The stage stays centered, so it may only grow to the nearer limit.
  const halfHeight =
    Math.min(centerY - container.top, bottomLimit - centerY) - FIT_MARGIN;
  const maxWidth = Math.max(1, container.width - 2 * FIT_MARGIN);
  const maxHeight = Math.max(1, 2 * halfHeight);
  const scale = Math.min(maxWidth / canvas.width, maxHeight / canvas.height);
  return Math.min(MAX_FIT_SCALE, Math.max(MIN_FIT_SCALE, scale));
}

/** Recomputes the fit whenever the window, container or toolbar resizes. */
export function useFitScale(
  containerRef: RefObject<HTMLElement | null>,
  toolbarRef: RefObject<HTMLElement | null>,
  canvasWidth: number,
  canvasHeight: number,
): number {
  const [fitScale, setFitScale] = useState(1);

  useEffect(() => {
    const update = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const toolbar = toolbarRef.current?.getBoundingClientRect();
      setFitScale(
        computeFitScale({
          container: { top: rect.top, bottom: rect.bottom, width: rect.width },
          toolbarTop: toolbar ? toolbar.top : null,
          canvas: { width: canvasWidth, height: canvasHeight },
        }),
      );
    };
    update();
    window.addEventListener('resize', update);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    [containerRef.current, toolbarRef.current].forEach((element) => {
      if (element) observer?.observe(element);
    });
    return () => {
      window.removeEventListener('resize', update);
      observer?.disconnect();
    };
  }, [containerRef, toolbarRef, canvasWidth, canvasHeight]);

  return fitScale;
}

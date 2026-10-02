import type { MaskBox, PiiMask, PiiMaskRect } from './types';

export const MANUAL_MASK_TAG = 'pii-manual';
const AUTO_ID_PREFIX = 'auto:';
const MANUAL_ID_PREFIX = 'manual:';
const MIN_MANUAL_MASK_SIZE = 2;

/** The user's change to one auto mask: removed, or moved/resized. */
export type AutoMaskOverride = { deleted: true } | { rect: MaskBox };

/** Stable id for a detection, so user changes survive recomputing masks. */
export function autoMaskId(detection: PiiMaskRect): string {
  const { tag, x, y, width, height } = detection;
  return `${AUTO_ID_PREFIX}${tag}:${[x, y, width, height].map(Math.round).join(',')}`;
}

export function manualMaskId(sequence: number): string {
  return `${MANUAL_ID_PREFIX}${sequence}`;
}

export function isManualMaskId(id: string): boolean {
  return id.startsWith(MANUAL_ID_PREFIX);
}

export function normalizeBox(box: MaskBox): MaskBox {
  return {
    x: Math.min(box.x, box.x + box.width),
    y: Math.min(box.y, box.y + box.height),
    width: Math.abs(box.width),
    height: Math.abs(box.height),
  };
}

export function isDrawableMask(box: MaskBox): boolean {
  const { width, height } = normalizeBox(box);
  return width >= MIN_MANUAL_MASK_SIZE && height >= MIN_MANUAL_MASK_SIZE;
}

export function shiftBox(box: MaskBox, dx: number, dy: number): MaskBox {
  return { ...box, x: box.x + dx, y: box.y + dy };
}

export function applyOverrides(
  autoMasks: PiiMask[],
  overrides: Record<string, AutoMaskOverride>,
): PiiMask[] {
  return autoMasks.flatMap((mask) => {
    const override = overrides[mask.id];
    if (!override) return [mask];
    if ('deleted' in override) return [];
    return [{ ...mask, rect: override.rect }];
  });
}

/** The topmost mask containing the point, or null. */
export function findMaskAt(
  masks: PiiMask[],
  x: number,
  y: number,
): string | null {
  const hit = [...masks]
    .reverse()
    .find(
      ({ rect }) =>
        x >= rect.x &&
        x <= rect.x + rect.width &&
        y >= rect.y &&
        y <= rect.y + rect.height,
    );
  return hit?.id ?? null;
}

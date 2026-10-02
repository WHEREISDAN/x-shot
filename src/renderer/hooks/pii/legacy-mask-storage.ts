// Older versions saved each capture's PII masks under this prefix. Masks are
// now recomputed from OCR for every capture, so the keys are dead weight.
const LEGACY_MASK_KEY_PREFIX = 'pii-masks:';

/** Removes saved PII masks left by older versions. Returns the count. */
export default function removeLegacyPiiMaskKeys(storage?: Storage): number {
  try {
    const target = storage ?? window.localStorage;
    const keys = Array.from({ length: target.length }, (_, index) =>
      target.key(index),
    ).filter(
      (key): key is string =>
        key !== null && key.startsWith(LEGACY_MASK_KEY_PREFIX),
    );
    keys.forEach((key) => target.removeItem(key));
    return keys.length;
  } catch {
    return 0;
  }
}

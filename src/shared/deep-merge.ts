export type PlainRecord = Record<string, unknown>;

export function isPlainObject(value: unknown): value is PlainRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Merges `updates` into `base` at every depth: objects merge key by key,
 * arrays and other values replace, and undefined leaves a key unchanged.
 */
export function deepMerge<T>(base: T, updates: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(updates)) {
    return (updates === undefined ? base : updates) as T;
  }
  const merged: PlainRecord = { ...base };
  Object.entries(updates).forEach(([key, value]) => {
    if (value === undefined) return;
    merged[key] = deepMerge(merged[key], value);
  });
  return merged as T;
}

const MAX_STRING_LENGTH = 256;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_DEPTH = 6;
const DATA_URL_IN_TEXT = /data:[\w.+-]+\/[\w.+-]+[^\s"'`)]*/gi;

const redact = (value: string): string => `[redacted:len=${value.length}]`;

/**
 * A log message with data URLs redacted and the length capped. Messages are
 * kept readable, unlike metadata strings, which are redacted whole.
 */
export function sanitizeLogMessage(message: string): string {
  const redacted = message.replace(DATA_URL_IN_TEXT, redact);
  if (redacted.length <= MAX_MESSAGE_LENGTH) return redacted;
  return `${redacted.slice(0, MAX_MESSAGE_LENGTH)}…[truncated:len=${redacted.length}]`;
}

function sanitize(
  value: unknown,
  depth: number,
  seen: WeakSet<object>,
): unknown {
  if (typeof value === 'string') {
    return value.startsWith('data:') || value.length > MAX_STRING_LENGTH
      ? redact(value)
      : value;
  }
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return '[circular]';
  if (depth >= MAX_DEPTH) return '[nested]';
  if (value instanceof Error) {
    return { name: value.name, message: sanitizeLogMessage(value.message) };
  }
  // `seen` holds only the current path, so shared objects are not cycles.
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((inner): unknown => sanitize(inner, depth + 1, seen));
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]): [string, unknown] => [
        key,
        sanitize(inner, depth + 1, seen),
      ]),
    );
  } finally {
    seen.delete(value);
  }
}

/**
 * Strips anything that could hold screenshot bytes, data URLs, OCR text or
 * PII from log metadata: strings starting with `data:` or longer than 256
 * characters become a length marker. Cycles and deep nesting are cut.
 */
export function sanitizeLogValue(value: unknown): unknown {
  return sanitize(value, 0, new WeakSet());
}

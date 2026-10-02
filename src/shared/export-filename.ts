// Tokens users can put in the export filename pattern. All use local time.
export const FILENAME_TOKENS = ['$TIMESTAMP', '$DATE', '$TIME'] as const;

const pad = (value: number) => String(value).padStart(2, '0');

/** Replaces every filename token in `pattern` with `now` in local time. */
export function formatFilename(pattern: string, now: Date): string {
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const time = `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const values: Record<string, string> = {
    TIMESTAMP: `${date}_${time}`,
    DATE: date,
    TIME: time,
  };
  // TIMESTAMP comes first so "$TIMESTAMP" is never read as "$TIME" + "STAMP".
  return pattern.replace(
    /\$(TIMESTAMP|DATE|TIME)/g,
    (_token, name: string) => values[name],
  );
}

/**
 * The name for the given attempt: "name.png", then "name (2).png",
 * "name (3).png", and so on, so an existing file is never overwritten.
 */
export function numberedFilename(
  base: string,
  extension: string,
  attempt: number,
): string {
  return attempt <= 1
    ? `${base}${extension}`
    : `${base} (${attempt})${extension}`;
}

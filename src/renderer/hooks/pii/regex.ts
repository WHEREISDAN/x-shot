import type { OcrLine, OcrWord } from './types';

export const emailRegex = /[a-zA-Z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
export const obfuscatedEmailRegex =
  /\b[A-Za-z0-9._%+-]+\s*(?:\(|\[)?at(?:\)|\])\s*[A-Za-z0-9.-]+\s*(?:\(|\[)?dot(?:\)|\])\s*[A-Za-z]{2,}\b/gi;
// Separators between digit groups are required, so unbroken digit runs
// (epoch timestamps, order numbers) never match; the lookarounds keep the
// pattern from matching part of a longer dotted or grouped number (IPs,
// card numbers). Formats: (555) 123-4567, 555-123-4567, 555.123.4567,
// +1 555 123 4567, +44 20 7946 0958, +15551234567, 555-1234, with an
// optional extension.
export const phoneRegex = new RegExp(
  [
    String.raw`(?<![\w.+]|\d[\s.-])`,
    '(?:',
    String.raw`\+\d{10,14}`,
    '|',
    String.raw`(?:\+\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-])\d{3,4}[\s.-]\d{3,4}`,
    '|',
    String.raw`\d{3}-\d{4}`,
    ')',
    String.raw`(?:\s*(?:x|ext\.?|extension)\s*\d{1,5})?`,
    String.raw`(?![\s.-]?\d)`,
  ].join(''),
  'g',
);

/** Each word as written, in lowercase and in uppercase. */
function caseVariants(words: string[]): string {
  const variants = words.flatMap((word) => [
    word,
    word.toLowerCase(),
    word.toUpperCase(),
  ]);
  // Longest first, so "Street" is tried before "St".
  return Array.from(new Set(variants))
    .sort((a, b) => b.length - a.length)
    .join('|');
}

const streetType = String.raw`(?:${caseVariants([
  'Street',
  'St',
  'Avenue',
  'Ave',
  'Road',
  'Rd',
  'Boulevard',
  'Blvd',
  'Lane',
  'Ln',
  'Drive',
  'Dr',
  'Court',
  'Ct',
  'Parkway',
  'Pkwy',
  'Way',
  'Terrace',
  'Ter',
  'Place',
  'Pl',
  'Square',
  'Sq',
  'Highway',
  'Hwy',
  'Circle',
  'Cir',
  'Loop',
  'Trail',
  'Trl',
  'Pike',
  'Plaza',
  'Plz',
  'Alley',
  'Aly',
  'Crescent',
  'Cres',
  'Close',
  'Row',
  'Walk',
])})\.?`;
const direction = String.raw`(?:North|South|East|West|NE|NW|SE|SW|N|S|E|W)\.?`;
const unit = String.raw`(?:,?\s+(?:${caseVariants([
  'Apartment',
  'Apt',
  'Suite',
  'Ste',
  'Unit',
  'Floor',
  'Fl',
  'Room',
  'Rm',
])})\.?\s*#?[A-Za-z0-9-]+|,?\s+#\s*[A-Za-z0-9-]+)`;
// Street names must be capitalized words or ordinals ("42nd"); that is what
// keeps prose such as "3 issues in Google Drive" from matching.
const nameWord = String.raw`(?:[A-Z][A-Za-z'.-]*|\d{1,3}(?:st|nd|rd|th))`;
const streetAddress = String.raw`\b\d{1,6}(?:-\d{1,6})?[A-Za-z]?\s+(?:${direction}\s+)?(?:${nameWord}\s+){1,4}${streetType}(?:\s+${direction})?${unit}?`;
const poBox = String.raw`\bP(?:ost)?\.?\s*O(?:ffice)?\.?\s*Box\s*\d+`;
export const addressRegex = new RegExp(
  `(?:${streetAddress}|${poBox})(?![A-Za-z0-9])`,
  'g',
);
export const ipv4Regex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
export const urlRegex = /\bhttps?:\/\/[^\s/$.?#].[^\s]*\b/gi;
export const domainRegex =
  /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}\b/gi;
export const ssnRegex = /\b\d{3}-\d{2}-\d{4}\b/g;
export const ssnLabelRegex = /(ssn|social\s*security)/i;
export const ccRegex = /\b(?:\d[ -]?){13,19}\b/g;
export const dobRegex =
  /\b(?:\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\d{4}[-/]\d{1,2}[-/]\d{1,2})\b/g;
export const dobLabelRegex = /(dob|date\s*of\s*birth|birthday)/i;
export const zipUSRegex = /\b\d{5}(?:-\d{4})?\b/g;
export const postalCARegex =
  /\b[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z][ -]?\d[ABCEGHJ-NPRSTV-Z]\d\b/g;
export const postalUKRegex =
  /\b([Gg][Ii][Rr] 0[Aa]{2})|((([A-Za-z][0-9]{1,2})|(([A-Za-z]{2}[0-9]{1,2})|([A-Za-z][0-9][A-Za-z])|([A-Za-z]{2}[0-9][A-Za-z])))[ ]?[0-9][A-Za-z]{2})\b/g;
export const uuidRegex =
  /\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}\b/g;
export const macRegex = /\b(?:[0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}\b/g;
export const ibanRegex = /\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g;
export const poBoxRegex = /\bP(?:ost)?\.?\s*O(?:ffice)?\.?\s*Box\s*\d+\b/gi;
export const tokensRegex =
  /\b(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|gh[pous]_[A-Za-z0-9]{36}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{10,})\b/g;

export function tokensToLineBoxes(
  words: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
  }>,
  rx: RegExp,
) {
  const parts = words.map((t) => t.text);
  const joined = parts.join(' ');
  const spans: Array<{ start: number; end: number }> = [];
  const pattern = new RegExp(rx.source, rx.flags);
  for (let match = pattern.exec(joined); match; match = pattern.exec(joined)) {
    spans.push({ start: match.index, end: match.index + match[0].length });
  }
  if (spans.length === 0)
    return [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const len = parts[i].length;
    ranges.push({ start: pos, end: pos + len });
    pos += len + (i < parts.length - 1 ? 1 : 0);
  }
  const results: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  spans.forEach((s) => {
    const startIdx = ranges.findIndex(
      (r) => s.start < r.end && s.end > r.start,
    );
    if (startIdx < 0) return;
    let endIdx = startIdx;
    for (let j = startIdx + 1; j < ranges.length; j += 1) {
      if (s.end > ranges[j].start) endIdx = j;
      else break;
    }
    const sliceB = words.slice(startIdx, endIdx + 1).map((t) => t.bbox);
    const minY = Math.min(...sliceB.map((b) => b.y));
    const maxY = Math.max(...sliceB.map((b) => b.y + b.height));
    const startTok = words[startIdx];
    const endTok = words[endIdx];
    const startLocal = Math.max(0, s.start - ranges[startIdx].start);
    const endLocal = Math.min(endTok.text.length, s.end - ranges[endIdx].start);
    const startFrac =
      startTok.text.length > 0 ? startLocal / startTok.text.length : 0;
    const endFrac = endTok.text.length > 0 ? endLocal / endTok.text.length : 1;
    const startX = startTok.bbox.x + startFrac * startTok.bbox.width;
    const endX = endTok.bbox.x + endFrac * endTok.bbox.width;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    results.push({
      x: Math.round(minX),
      y: minY,
      width: Math.round(maxX - minX),
      height: maxY - minY,
    });
  });
  return results;
}

export function lineBoxesFor(lines: OcrLine[], words: OcrWord[], rx: RegExp) {
  return lines.flatMap((ln) => {
    const ly0 = ln.bbox.y;
    const ly1 = ln.bbox.y + ln.bbox.height;
    const lineWords = words
      .filter((w) => {
        const wy0 = w.bbox.y;
        const wy1 = w.bbox.y + w.bbox.height;
        const overlap = Math.max(0, Math.min(ly1, wy1) - Math.max(ly0, wy0));
        const minH = Math.min(ln.bbox.height, w.bbox.height);
        return minH > 0 && overlap / minH >= 0.5;
      })
      .sort((a, b) => a.bbox.x - b.bbox.x);
    return tokensToLineBoxes(lineWords, rx);
  });
}

export function lineBoxesForWithLabel(
  lines: OcrLine[],
  words: OcrWord[],
  valueRx: RegExp,
  labelRx: RegExp,
) {
  return lines.flatMap((ln) => {
    if (!labelRx.test(ln.text || ''))
      return [] as Array<{
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    const ly0 = ln.bbox.y;
    const ly1 = ln.bbox.y + ln.bbox.height;
    const lineWords = words
      .filter((w) => {
        const wy0 = w.bbox.y;
        const wy1 = w.bbox.y + w.bbox.height;
        const overlap = Math.max(0, Math.min(ly1, wy1) - Math.max(ly0, wy0));
        const minH = Math.min(ln.bbox.height, w.bbox.height);
        return minH > 0 && overlap / minH >= 0.5;
      })
      .sort((a, b) => a.bbox.x - b.bbox.x);
    return tokensToLineBoxes(lineWords, valueRx);
  });
}

export function fallbackWordBoxesFor(
  words: OcrWord[],
  rx: RegExp,
  existing: Array<{ x: number; y: number; width: number; height: number }>,
) {
  if (existing.length > 0)
    return [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  if (!words || words.length === 0)
    return [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  const sorted = [...words].sort(
    (a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x,
  );
  const yTol = (h: number) => Math.max(2, Math.round(h * 0.6));
  const groups = sorted.reduce<Array<typeof sorted>>((acc, w) => {
    const last = acc[acc.length - 1];
    if (!last) return [[w]];
    const avgY = last.reduce((s, it) => s + it.bbox.y, 0) / last.length;
    const avgH = last.reduce((s, it) => s + it.bbox.height, 0) / last.length;
    return Math.abs(w.bbox.y - avgY) <= yTol(avgH)
      ? (last.push(w), acc)
      : [...acc, [w]];
  }, []);
  return groups.flatMap((g) =>
    tokensToLineBoxes(
      g.sort((a, b) => a.bbox.x - b.bbox.x),
      rx,
    ),
  );
}

export function tokensToLineBoxesWithFilter(
  words: Array<{
    text: string;
    bbox: { x: number; y: number; width: number; height: number };
  }>,
  rx: RegExp,
  accept: (matchedText: string) => boolean,
) {
  const parts = words.map((t) => t.text);
  const joined = parts.join(' ');
  const spans: Array<{ start: number; end: number; text: string }> = [];
  const pattern = new RegExp(rx.source, rx.flags);
  for (let match = pattern.exec(joined); match; match = pattern.exec(joined)) {
    if (accept(match[0])) {
      spans.push({
        start: match.index,
        end: match.index + match[0].length,
        text: match[0],
      });
    }
  }
  if (spans.length === 0)
    return [] as Array<{
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  const ranges: Array<{ start: number; end: number }> = [];
  let pos = 0;
  for (let i = 0; i < parts.length; i += 1) {
    const len = parts[i].length;
    ranges.push({ start: pos, end: pos + len });
    pos += len + (i < parts.length - 1 ? 1 : 0);
  }
  const results: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];
  spans.forEach((s) => {
    const startIdx = ranges.findIndex(
      (r) => s.start < r.end && s.end > r.start,
    );
    if (startIdx < 0) return;
    let endIdx = startIdx;
    for (let j = startIdx + 1; j < ranges.length; j += 1) {
      if (s.end > ranges[j].start) endIdx = j;
      else break;
    }
    const sliceB = words.slice(startIdx, endIdx + 1).map((t) => t.bbox);
    const minY = Math.min(...sliceB.map((b) => b.y));
    const maxY = Math.max(...sliceB.map((b) => b.y + b.height));
    const startTok = words[startIdx];
    const endTok = words[endIdx];
    const startLocal = Math.max(0, s.start - ranges[startIdx].start);
    const endLocal = Math.min(endTok.text.length, s.end - ranges[endIdx].start);
    const startFrac =
      startTok.text.length > 0 ? startLocal / startTok.text.length : 0;
    const endFrac = endTok.text.length > 0 ? endLocal / endTok.text.length : 1;
    const startX = startTok.bbox.x + startFrac * startTok.bbox.width;
    const endX = endTok.bbox.x + endFrac * endTok.bbox.width;
    const minX = Math.min(startX, endX);
    const maxX = Math.max(startX, endX);
    results.push({
      x: Math.round(minX),
      y: minY,
      width: Math.round(maxX - minX),
      height: maxY - minY,
    });
  });
  return results;
}

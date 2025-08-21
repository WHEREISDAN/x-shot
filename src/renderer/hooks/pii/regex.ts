import type { OcrLine, OcrWord } from './types';

export const emailRegex = /[a-zA-Z0-9._%+-]+@(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}/g;
export const obfuscatedEmailRegex =
  /\b[A-Za-z0-9._%+-]+\s*(?:\(|\[)?at(?:\)|\])\s*[A-Za-z0-9.-]+\s*(?:\(|\[)?dot(?:\)|\])\s*[A-Za-z]{2,}\b/gi;
export const phoneRegex =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{2,4}\)[\s.-]?|\d{2,4}[\s.-]?)\d{3,4}[\s.-]?\d{3,4}(?:\s*(?:x|ext\.?|extension)\s*\d{1,5})?/g;
const streetType =
  '(?:St|Street|Ave|Avenue|Rd|Road|Blvd|Boulevard|Ln|Lane|Dr|Drive|Ct|Court|Pkwy|Parkway|Way|Ter|Terrace|Pl|Place|Sq|Square|Hwy|Highway|Cir|Circle)\\.?';
const dir = '(?:N|S|E|W|NE|NW|SE|SW)';
export const addressRegex = new RegExp(
  String.raw`\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+)*\s+${streetType}(?:\s+${dir})?(?:\s+(?:Apt|Apartment|Unit|Suite|Ste|#)\s*\w+)?\b`,
  'gi',
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

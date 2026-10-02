import type { MaskBox, OcrLine, OcrWord } from './types';

/** A match as character offsets into words joined by single spaces. */
export interface TextSpan {
  start: number;
  end: number;
}

export type SpanFinder = (text: string) => TextSpan[];

/** A detector: a regular expression or a function that finds its spans. */
export type Matcher = RegExp | SpanFinder;

function findSpans(text: string, matcher: Matcher): TextSpan[] {
  if (typeof matcher === 'function') return matcher(text);
  const flags = matcher.flags.includes('g')
    ? matcher.flags
    : `${matcher.flags}g`;
  return Array.from(text.matchAll(new RegExp(matcher.source, flags)), (m) => ({
    start: m.index ?? 0,
    end: (m.index ?? 0) + m[0].length,
  }));
}

/** Boxes for every match in `words`, which must be one line in reading order. */
export function tokensToLineBoxes(
  words: OcrWord[],
  matcher: Matcher,
): MaskBox[] {
  const parts = words.map((t) => t.text);
  const spans = findSpans(parts.join(' '), matcher);
  if (spans.length === 0) return [];

  const ranges = parts.reduce<TextSpan[]>((acc, part) => {
    const start = acc.length > 0 ? acc[acc.length - 1].end + 1 : 0;
    return [...acc, { start, end: start + part.length }];
  }, []);

  return spans.flatMap((s) => {
    const startIdx = ranges.findIndex(
      (r) => s.start < r.end && s.end > r.start,
    );
    if (startIdx < 0) return [];
    const lastIdx = ranges.findIndex(
      (r, i) => i > startIdx && s.end <= r.start,
    );
    const endIdx = lastIdx < 0 ? ranges.length - 1 : lastIdx - 1;
    const boxes = words.slice(startIdx, endIdx + 1).map((t) => t.bbox);
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxY = Math.max(...boxes.map((b) => b.y + b.height));
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
    return [
      {
        x: Math.round(minX),
        y: minY,
        width: Math.round(maxX - minX),
        height: maxY - minY,
      },
    ];
  });
}

/** The words that sit on an OCR line, left to right. */
function wordsOnLine(line: OcrLine, words: OcrWord[]): OcrWord[] {
  const ly0 = line.bbox.y;
  const ly1 = line.bbox.y + line.bbox.height;
  return words
    .filter((w) => {
      const overlap = Math.max(
        0,
        Math.min(ly1, w.bbox.y + w.bbox.height) - Math.max(ly0, w.bbox.y),
      );
      const minH = Math.min(line.bbox.height, w.bbox.height);
      return minH > 0 && overlap / minH >= 0.5;
    })
    .sort((a, b) => a.bbox.x - b.bbox.x);
}

/**
 * Matches on each OCR line. With `label`, only lines whose text also
 * matches the label count (SSNs and birth dates need "SSN", "DOB", ...).
 */
export function lineBoxesFor(
  lines: OcrLine[],
  words: OcrWord[],
  matcher: Matcher,
  label?: RegExp,
): MaskBox[] {
  return lines
    .filter((line) => !label || label.test(line.text || ''))
    .flatMap((line) => tokensToLineBoxes(wordsOnLine(line, words), matcher));
}

/** Groups words into visual lines by vertical position, left to right. */
function groupWordsIntoLines(words: OcrWord[]): OcrWord[][] {
  const sorted = [...words].sort(
    (a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x,
  );
  const yTol = (h: number) => Math.max(2, Math.round(h * 0.6));
  const groups = sorted.reduce<OcrWord[][]>((acc, w) => {
    const last = acc[acc.length - 1];
    if (!last) return [[w]];
    const avgY = last.reduce((s, it) => s + it.bbox.y, 0) / last.length;
    const avgH = last.reduce((s, it) => s + it.bbox.height, 0) / last.length;
    if (Math.abs(w.bbox.y - avgY) <= yTol(avgH)) {
      last.push(w);
      return acc;
    }
    return [...acc, [w]];
  }, []);
  return groups.map((g) => g.sort((a, b) => a.bbox.x - b.bbox.x));
}

/**
 * Fallback when the OCR lines found nothing: the same search over words
 * grouped into lines by position. Matches never span two lines, and `label`
 * applies here exactly as it does in lineBoxesFor.
 */
export function fallbackWordBoxesFor(
  words: OcrWord[],
  matcher: Matcher,
  existing: MaskBox[],
  label?: RegExp,
): MaskBox[] {
  if (existing.length > 0 || !words || words.length === 0) return [];
  return groupWordsIntoLines(words)
    .filter((group) => !label || label.test(group.map((w) => w.text).join(' ')))
    .flatMap((group) => tokensToLineBoxes(group, matcher));
}

import type { TextSpan } from './line-boxes';

const MIN_CARD_DIGITS = 13;
const MAX_CARD_DIGITS = 19;
// Digit groups separated by single spaces or dashes, e.g. "4111 1111 1111".
const DIGIT_RUN = /(?<![\w-])\d+(?:[ -]\d+)*/g;

export function luhnValid(digits: string): boolean {
  if (digits.length < MIN_CARD_DIGITS || digits.length > MAX_CARD_DIGITS) {
    return false;
  }
  const sum = Array.from(digits)
    .reverse()
    .reduce((total, char, index) => {
      const digit = Number(char) * (index % 2 === 1 ? 2 : 1);
      return total + (digit > 9 ? digit - 9 : digit);
    }, 0);
  return sum % 10 === 0;
}

/**
 * Card numbers in `text`. Within a run of digit groups, the longest
 * Luhn-valid prefix starting at each group wins, so digits that follow a
 * card ("4111 1111 1111 1111 12/25") do not hide it.
 */
export function findCardNumberSpans(text: string): TextSpan[] {
  return Array.from(text.matchAll(DIGIT_RUN)).flatMap((run) => {
    const offset = run.index ?? 0;
    const groups = Array.from(run[0].matchAll(/\d+/g), (m) => ({
      start: offset + (m.index ?? 0),
      end: offset + (m.index ?? 0) + m[0].length,
      digits: m[0],
    }));

    const spans: TextSpan[] = [];
    let first = 0;
    while (first < groups.length) {
      let digits = '';
      let last = -1;
      for (let i = first; i < groups.length; i += 1) {
        digits += groups[i].digits;
        if (digits.length > MAX_CARD_DIGITS) break;
        if (luhnValid(digits)) last = i;
      }
      if (last >= 0) {
        spans.push({ start: groups[first].start, end: groups[last].end });
        first = last + 1;
      } else {
        first += 1;
      }
    }
    return spans;
  });
}

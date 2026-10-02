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

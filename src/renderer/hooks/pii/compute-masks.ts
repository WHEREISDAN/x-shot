import type { OcrLine, OcrWord, PiiMaskRect, PiiDetectors } from './types';
import {
  addressRegex,
  ccRegex,
  dobLabelRegex,
  dobRegex,
  domainRegex,
  emailRegex,
  ipv4Regex,
  ibanRegex,
  lineBoxesFor,
  lineBoxesForWithLabel,
  macRegex,
  obfuscatedEmailRegex,
  phoneRegex,
  poBoxRegex,
  postalCARegex,
  postalUKRegex,
  ssnLabelRegex,
  ssnRegex,
  tokensRegex,
  urlRegex,
  uuidRegex,
  zipUSRegex,
  fallbackWordBoxesFor,
  tokensToLineBoxesWithFilter,
} from './regex';

function luhnValid(raw: string) {
  const digits = raw.replace(/[^0-9]/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let shouldDouble = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = parseInt(digits[i], 10);
    if (shouldDouble) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    shouldDouble = !shouldDouble;
  }
  return sum % 10 === 0;
}

function dedup(
  arr: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const map = new Map<
    string,
    { x: number; y: number; width: number; height: number }
  >();
  arr.forEach((b) => {
    const key = `${b.x}|${b.y}|${b.width}|${b.height}`;
    if (!map.has(key)) map.set(key, b);
  });
  return Array.from(map.values());
}

function mergeOverlap(
  input: Array<{ x: number; y: number; width: number; height: number }>,
) {
  const V_OVERLAP_RATIO = 0.5;
  const result: Array<{ x: number; y: number; width: number; height: number }> =
    [];
  input.forEach((b) => {
    const idx = result.findIndex((r) => {
      const x1 = Math.max(r.x, b.x);
      const y1 = Math.max(r.y, b.y);
      const x2 = Math.min(r.x + r.width, b.x + b.width);
      const y2 = Math.min(r.y + r.height, b.y + b.height);
      const overlap = x2 > x1 && y2 > y1;
      const vertOverlap = Math.max(0, y2 - y1) / Math.min(r.height, b.height);
      return overlap && vertOverlap >= V_OVERLAP_RATIO;
    });
    if (idx >= 0) {
      const r = result[idx];
      const minX = Math.min(r.x, b.x);
      const minY = Math.min(r.y, b.y);
      const maxX = Math.max(r.x + r.width, b.x + b.width);
      const maxY = Math.max(r.y + r.height, b.y + b.height);
      result[idx] = {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    } else {
      result.push(b);
    }
  });
  return result;
}

export default function computePiiMasks(
  enabled: PiiDetectors,
  lines: OcrLine[],
  words: OcrWord[],
): PiiMaskRect[] {
  const lineBoxesEmail = enabled.email
    ? lineBoxesFor(lines, words, emailRegex)
    : [];
  const lineBoxesEmailObf = enabled.email
    ? lineBoxesFor(lines, words, obfuscatedEmailRegex)
    : [];
  const lineBoxesPhone = enabled.phone
    ? lineBoxesFor(lines, words, phoneRegex)
    : [];
  const lineBoxesAddress = enabled.address
    ? lineBoxesFor(lines, words, addressRegex)
    : [];
  const wordBoxesEmail = enabled.email
    ? fallbackWordBoxesFor(words, emailRegex, [
        ...lineBoxesEmail,
        ...lineBoxesEmailObf,
      ])
    : [];
  const wordBoxesEmailObf = enabled.email
    ? fallbackWordBoxesFor(words, obfuscatedEmailRegex, [
        ...lineBoxesEmail,
        ...lineBoxesEmailObf,
      ])
    : [];
  const wordBoxesPhone = enabled.phone
    ? fallbackWordBoxesFor(words, phoneRegex, lineBoxesPhone)
    : [];
  const wordBoxesAddress = enabled.address
    ? fallbackWordBoxesFor(words, addressRegex, lineBoxesAddress)
    : [];

  const lineBoxesIpv4 = enabled.ipv4
    ? lineBoxesFor(lines, words, ipv4Regex)
    : [];
  const wordBoxesIpv4 = enabled.ipv4
    ? fallbackWordBoxesFor(words, ipv4Regex, lineBoxesIpv4)
    : [];
  const lineBoxesUrl = enabled.url
    ? [
        ...lineBoxesFor(lines, words, urlRegex),
        ...lineBoxesFor(lines, words, domainRegex),
      ]
    : [];
  const wordBoxesUrl = enabled.url
    ? [
        ...fallbackWordBoxesFor(words, urlRegex, lineBoxesUrl),
        ...fallbackWordBoxesFor(words, domainRegex, lineBoxesUrl),
      ]
    : [];
  const lineBoxesSsn = enabled.ssn
    ? lineBoxesForWithLabel(lines, words, ssnRegex, ssnLabelRegex)
    : [];
  const wordBoxesSsn = enabled.ssn
    ? fallbackWordBoxesFor(words, ssnRegex, lineBoxesSsn)
    : [];
  const lineBoxesDob = enabled.dob
    ? lineBoxesForWithLabel(lines, words, dobRegex, dobLabelRegex)
    : [];
  const wordBoxesDob = enabled.dob
    ? fallbackWordBoxesFor(words, dobRegex, lineBoxesDob)
    : [];
  const lineBoxesZipUS = enabled.postalUS
    ? lineBoxesFor(lines, words, zipUSRegex)
    : [];
  const wordBoxesZipUS = enabled.postalUS
    ? fallbackWordBoxesFor(words, zipUSRegex, lineBoxesZipUS)
    : [];
  const lineBoxesPostalCA = enabled.postalCA
    ? lineBoxesFor(lines, words, postalCARegex)
    : [];
  const wordBoxesPostalCA = enabled.postalCA
    ? fallbackWordBoxesFor(words, postalCARegex, lineBoxesPostalCA)
    : [];
  const lineBoxesPostalUK = enabled.postalUK
    ? lineBoxesFor(lines, words, postalUKRegex)
    : [];
  const wordBoxesPostalUK = enabled.postalUK
    ? fallbackWordBoxesFor(words, postalUKRegex, lineBoxesPostalUK)
    : [];
  const lineBoxesUuid = enabled.uuid
    ? lineBoxesFor(lines, words, uuidRegex)
    : [];
  const wordBoxesUuid = enabled.uuid
    ? fallbackWordBoxesFor(words, uuidRegex, lineBoxesUuid)
    : [];
  const lineBoxesMac = enabled.mac ? lineBoxesFor(lines, words, macRegex) : [];
  const wordBoxesMac = enabled.mac
    ? fallbackWordBoxesFor(words, macRegex, lineBoxesMac)
    : [];
  const lineBoxesIban = enabled.iban
    ? lineBoxesFor(lines, words, ibanRegex)
    : [];
  const wordBoxesIban = enabled.iban
    ? fallbackWordBoxesFor(words, ibanRegex, lineBoxesIban)
    : [];
  const lineBoxesPoBox = enabled.poBox
    ? lineBoxesFor(lines, words, poBoxRegex)
    : [];
  const wordBoxesPoBox = enabled.poBox
    ? fallbackWordBoxesFor(words, poBoxRegex, lineBoxesPoBox)
    : [];
  const lineBoxesTokens = enabled.tokens
    ? lineBoxesFor(lines, words, tokensRegex)
    : [];
  const wordBoxesTokens = enabled.tokens
    ? fallbackWordBoxesFor(words, tokensRegex, lineBoxesTokens)
    : [];

  const ccBoxesLine = enabled.creditCard
    ? lines.flatMap((ln) => {
        const ly0 = ln.bbox.y;
        const ly1 = ln.bbox.y + ln.bbox.height;
        const lineWords = words
          .filter((w) => {
            const wy0 = w.bbox.y;
            const wy1 = w.bbox.y + w.bbox.height;
            const overlap = Math.max(
              0,
              Math.min(ly1, wy1) - Math.max(ly0, wy0),
            );
            const minH = Math.min(ln.bbox.height, w.bbox.height);
            return minH > 0 && overlap / minH >= 0.5;
          })
          .sort((a, b) => a.bbox.x - b.bbox.x);
        return tokensToLineBoxesWithFilter(
          lineWords as any,
          ccRegex,
          luhnValid,
        );
      })
    : [];

  const ccBoxesWord = enabled.creditCard
    ? tokensToLineBoxesWithFilter(
        [...words].sort(
          (a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x,
        ) as any,
        ccRegex,
        luhnValid,
      )
    : [];

  const boxesRawEmail = [
    ...lineBoxesEmail,
    ...lineBoxesEmailObf,
    ...wordBoxesEmail,
    ...wordBoxesEmailObf,
  ];
  const boxesRawPhone = [...lineBoxesPhone, ...wordBoxesPhone];
  const boxesRawAddress = [...lineBoxesAddress, ...wordBoxesAddress];
  const boxesRawIpv4 = [...lineBoxesIpv4, ...wordBoxesIpv4];
  const boxesRawUrl = [...lineBoxesUrl, ...wordBoxesUrl];
  const boxesRawSsn = [...lineBoxesSsn, ...wordBoxesSsn];
  const boxesRawDob = [...lineBoxesDob, ...wordBoxesDob];
  const boxesRawZipUS = [...lineBoxesZipUS, ...wordBoxesZipUS];
  const boxesRawPostalCA = [...lineBoxesPostalCA, ...wordBoxesPostalCA];
  const boxesRawPostalUK = [...lineBoxesPostalUK, ...wordBoxesPostalUK];
  const boxesRawUuid = [...lineBoxesUuid, ...wordBoxesUuid];
  const boxesRawMac = [...lineBoxesMac, ...wordBoxesMac];
  const boxesRawIban = [...lineBoxesIban, ...wordBoxesIban];
  const boxesRawPoBox = [...lineBoxesPoBox, ...wordBoxesPoBox];
  const boxesRawTokens = [...lineBoxesTokens, ...wordBoxesTokens];

  const masks: PiiMaskRect[] = [
    ...mergeOverlap(dedup(boxesRawEmail)).map((b) => ({
      ...b,
      tag: 'pii-email',
    })),
    ...mergeOverlap(dedup(boxesRawPhone)).map((b) => ({
      ...b,
      tag: 'pii-phone',
    })),
    ...mergeOverlap(dedup(boxesRawAddress)).map((b) => ({
      ...b,
      tag: 'pii-address',
    })),
    ...mergeOverlap(dedup(boxesRawIpv4)).map((b) => ({
      ...b,
      tag: 'pii-ipv4',
    })),
    ...mergeOverlap(dedup(boxesRawUrl)).map((b) => ({ ...b, tag: 'pii-url' })),
    ...mergeOverlap(dedup(boxesRawSsn)).map((b) => ({ ...b, tag: 'pii-ssn' })),
    ...mergeOverlap(dedup([...ccBoxesLine, ...ccBoxesWord])).map((b) => ({
      ...b,
      tag: 'pii-cc',
    })),
    ...mergeOverlap(dedup(boxesRawDob)).map((b) => ({ ...b, tag: 'pii-dob' })),
    ...mergeOverlap(dedup(boxesRawZipUS)).map((b) => ({
      ...b,
      tag: 'pii-postal-us',
    })),
    ...mergeOverlap(dedup(boxesRawPostalCA)).map((b) => ({
      ...b,
      tag: 'pii-postal-ca',
    })),
    ...mergeOverlap(dedup(boxesRawPostalUK)).map((b) => ({
      ...b,
      tag: 'pii-postal-uk',
    })),
    ...mergeOverlap(dedup(boxesRawUuid)).map((b) => ({
      ...b,
      tag: 'pii-uuid',
    })),
    ...mergeOverlap(dedup(boxesRawMac)).map((b) => ({ ...b, tag: 'pii-mac' })),
    ...mergeOverlap(dedup(boxesRawIban)).map((b) => ({
      ...b,
      tag: 'pii-iban',
    })),
    ...mergeOverlap(dedup(boxesRawPoBox)).map((b) => ({
      ...b,
      tag: 'pii-po-box',
    })),
    ...mergeOverlap(dedup(boxesRawTokens)).map((b) => ({
      ...b,
      tag: 'pii-token',
    })),
  ];

  return masks;
}

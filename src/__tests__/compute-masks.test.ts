import computePiiMasks from '../renderer/hooks/pii/compute-masks';
import type {
  OcrLine,
  OcrWord,
  PiiDetectors,
} from '../renderer/hooks/pii/types';

const CHAR_WIDTH = 10;
const LINE_HEIGHT = 20;

const NONE: PiiDetectors = {
  email: false,
  phone: false,
  address: false,
  ipv4: false,
  url: false,
  ssn: false,
  creditCard: false,
  dob: false,
  postalUS: false,
  postalCA: false,
  postalUK: false,
  uuid: false,
  mac: false,
  iban: false,
  poBox: false,
  tokens: false,
};

/** Lays text out as OCR words, CHAR_WIDTH px per character and space. */
function ocrLines(texts: string[]): { lines: OcrLine[]; words: OcrWord[] } {
  const words: OcrWord[] = [];
  const lines = texts.map((text, row) => {
    const y = row * LINE_HEIGHT * 2;
    let x = 0;
    text.split(' ').forEach((token) => {
      words.push({
        text: token,
        bbox: { x, y, width: token.length * CHAR_WIDTH, height: LINE_HEIGHT },
        confidence: 95,
      });
      x += (token.length + 1) * CHAR_WIDTH;
    });
    return {
      text,
      bbox: { x: 0, y, width: text.length * CHAR_WIDTH, height: LINE_HEIGHT },
    };
  });
  return { lines, words };
}

/** The box a match should get: from its first to its last character. */
function spanOf(text: string, match: string, row = 0) {
  const start = text.indexOf(match);
  return {
    x: start * CHAR_WIDTH,
    y: row * LINE_HEIGHT * 2,
    width: match.length * CHAR_WIDTH,
    height: LINE_HEIGHT,
  };
}

function masksFor(detectors: Partial<PiiDetectors>, texts: string[]) {
  const { lines, words } = ocrLines(texts);
  return computePiiMasks({ ...NONE, ...detectors }, lines, words);
}

/** OCR results without line data, which takes the word-grouping fallback. */
function masksForWordsOnly(detectors: Partial<PiiDetectors>, texts: string[]) {
  const { words } = ocrLines(texts);
  return computePiiMasks({ ...NONE, ...detectors }, [], words);
}

const tags = (masks: { tag: string }[]) => masks.map((m) => m.tag);

describe('computePiiMasks', () => {
  it('boxes each detected value from its first to its last character', () => {
    const text = 'Mail jane@example.com or call 555-123-4567 today';
    const masks = masksFor({ email: true, phone: true }, [text]);

    expect(masks).toEqual([
      { ...spanOf(text, 'jane@example.com'), tag: 'pii-email' },
      { ...spanOf(text, '555-123-4567'), tag: 'pii-phone' },
    ]);
  });

  it('tags an IP address only as an IP, never as a phone number', () => {
    const masks = masksFor({ phone: true, ipv4: true }, [
      'Server at 192.168.10.24 is online',
    ]);
    expect(masks.map((m) => m.tag)).toEqual(['pii-ipv4']);
  });

  it('ignores timestamps and order numbers', () => {
    expect(
      masksFor({ phone: true }, ['Created 1696262400 order 12345678']),
    ).toEqual([]);
  });

  it('masks an address with its unit and skips prose', () => {
    const text = 'Ship to 10 Downing St, Apt 4B today';
    const masks = masksFor({ address: true }, [
      text,
      '3 issues in Google Drive',
    ]);
    expect(masks).toEqual([
      { ...spanOf(text, '10 Downing St, Apt 4B'), tag: 'pii-address' },
    ]);
  });

  it('only runs enabled detectors', () => {
    const texts = ['jane@example.com 555-123-4567 10.0.0.1'];
    expect(masksFor({}, texts)).toEqual([]);
    expect(masksFor({ email: true }, texts).map((m) => m.tag)).toEqual([
      'pii-email',
    ]);
  });

  it('keeps card numbers that pass the Luhn check', () => {
    expect(
      masksFor({ creditCard: true }, ['Card 4111 1111 1111 1111']).map(
        (m) => m.tag,
      ),
    ).toEqual(['pii-cc']);
    expect(
      masksFor({ creditCard: true }, ['Card 4111 1111 1111 1112']),
    ).toEqual([]);
  });

  it('masks a card number followed by an expiry date', () => {
    const text = 'Card 4111 1111 1111 1111 12/25';
    const expected = [
      { ...spanOf(text, '4111 1111 1111 1111'), tag: 'pii-cc' },
    ];
    expect(masksFor({ creditCard: true }, [text])).toEqual(expected);
    expect(masksForWordsOnly({ creditCard: true }, [text])).toEqual(expected);
  });

  it('never joins card digits from two lines', () => {
    const texts = ['Ref 4111 1111', '1111 1111'];
    expect(masksFor({ creditCard: true }, texts)).toEqual([]);
    expect(masksForWordsOnly({ creditCard: true }, texts)).toEqual([]);
  });

  it.each([
    ['ssn', 'SSN 123-45-6789', 'Order 123-45-6789', 'pii-ssn'],
    ['dob', 'DOB 01/02/1990', 'Invoice 01/02/1990', 'pii-dob'],
  ] as const)(
    'masks %s values only on labelled lines, on every path',
    (detector, labelled, unlabelled, tag) => {
      const enabled = { [detector]: true };
      expect(tags(masksFor(enabled, [labelled]))).toEqual([tag]);
      expect(tags(masksForWordsOnly(enabled, [labelled]))).toEqual([tag]);
      expect(masksFor(enabled, [unlabelled])).toEqual([]);
      expect(masksForWordsOnly(enabled, [unlabelled])).toEqual([]);
    },
  );

  it('reports each value once per line', () => {
    const masks = masksFor({ email: true }, [
      'jane@example.com',
      'bob@sample.org',
    ]);
    expect(masks).toHaveLength(2);
    expect(new Set(masks.map((m) => m.y)).size).toBe(2);
  });
});

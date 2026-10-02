/**
 * @jest-environment node
 */
import { formatFilename, numberedFilename } from '../shared/export-filename';

// A moment whose local calendar differs from UTC: 2026-01-01 15:30 UTC is
// already 2026-01-02 04:30 in Auckland. Only the local getters are real, so
// a formatter that reads UTC (or toISOString) fails in every time zone.
const INSTANT = {
  getFullYear: () => 2026,
  getMonth: () => 0,
  getDate: () => 2,
  getHours: () => 4,
  getMinutes: () => 30,
  getSeconds: () => 0,
  getUTCFullYear: () => 2026,
  getUTCMonth: () => 0,
  getUTCDate: () => 1,
  getUTCHours: () => 15,
  getUTCMinutes: () => 30,
  getUTCSeconds: () => 0,
  toISOString: () => '2026-01-01T15:30:00.000Z',
} as unknown as Date;

describe('formatFilename', () => {
  it.each([
    ['$DATE', '2026-01-02'],
    ['$TIME', '04-30-00'],
    ['$TIMESTAMP', '2026-01-02_04-30-00'],
  ])('formats %s in local time', (pattern, expected) => {
    expect(formatFilename(pattern, INSTANT)).toBe(expected);
  });

  it('replaces every occurrence of every token', () => {
    expect(formatFilename('$DATE-$DATE_$TIME_$TIME', INSTANT)).toBe(
      '2026-01-02-2026-01-02_04-30-00_04-30-00',
    );
    expect(formatFilename('X-Shot_$TIMESTAMP ($TIME)', INSTANT)).toBe(
      'X-Shot_2026-01-02_04-30-00 (04-30-00)',
    );
  });

  it('pads single-digit parts and leaves other text alone', () => {
    const local = new Date(2026, 2, 4, 5, 6, 7);
    expect(formatFilename('shot_$TIMESTAMP', local)).toBe(
      'shot_2026-03-04_05-06-07',
    );
    expect(formatFilename('plain $FOO name', local)).toBe('plain $FOO name');
  });
});

describe('numberedFilename', () => {
  it.each([
    [1, 'shot.png'],
    [2, 'shot (2).png'],
    [10, 'shot (10).png'],
  ])('names attempt %i %j', (attempt, expected) => {
    expect(numberedFilename('shot', '.png', attempt)).toBe(expected);
  });
});

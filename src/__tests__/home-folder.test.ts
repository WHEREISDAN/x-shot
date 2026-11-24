import { tildePath } from '../renderer/components/preferences/home-folder';

describe('tildePath', () => {
  it('writes a path in the home folder from ~ on macOS and Linux', () => {
    expect(tildePath('/Users/alex/Pictures/Screenshots', '/Users/alex')).toBe(
      '~/Pictures/Screenshots',
    );
    expect(tildePath('/home/alex/Pictures', '/home/alex/')).toBe('~/Pictures');
    expect(tildePath('/home/alex', '/home/alex')).toBe('~');
  });

  it('leaves other paths as they are', () => {
    expect(tildePath('/Users/alexandra/Pictures', '/Users/alex')).toBe(
      '/Users/alexandra/Pictures',
    );
    expect(tildePath('/tmp/shots', '/Users/alex')).toBe('/tmp/shots');
    expect(tildePath('/Users/alex/Pictures', null)).toBe(
      '/Users/alex/Pictures',
    );
  });

  it('leaves Windows paths as they are', () => {
    expect(
      tildePath('C:\\Users\\alex\\Pictures\\Screenshots', 'C:\\Users\\alex'),
    ).toBe('C:\\Users\\alex\\Pictures\\Screenshots');
  });
});

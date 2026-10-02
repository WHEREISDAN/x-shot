/**
 * @jest-environment node
 */
import { asarProblems } from '../../.erb/scripts/check-package';

const MB = 1024 * 1024;

describe('asarProblems', () => {
  it('passes an archive of dist only', () => {
    expect(
      asarProblems(37 * MB, [
        '/dist/main/main.js',
        '/dist/renderer/renderer.js',
        '/package.json',
      ]),
    ).toEqual([]);
  });

  it('flags what the packaging used to ship', () => {
    expect(
      asarProblems(101 * MB, [
        '/dist/renderer/renderer.js.map',
        '/node_modules/react/index.js',
        '\\node_modules\\react-dom\\index.js',
      ]),
    ).toEqual([
      'is 101.0 MB, over the 50 MB limit',
      'ships 1 source maps, e.g. /dist/renderer/renderer.js.map',
      'ships node_modules (2 entries), e.g. /node_modules/react/index.js',
    ]);
  });
});

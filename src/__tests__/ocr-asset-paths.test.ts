/**
 * @jest-environment node
 */
import { resolveOcrAssetPaths } from '../renderer/hooks/ocr-assets';

const DOCUMENT_URLS = [
  'http://localhost:1212/index.html',
  'file:///Applications/X-Shot.app/Contents/Resources/app.asar/dist/renderer/index.html',
];

// Bundled asset URLs as webpack emits them for the dev ('/') and production
// ('./') publicPath.
const BUNDLED_ASSETS = ['/', './'].map((publicPath) => ({
  workerUrl: `${publicPath}ocr/worker.min.ab40e4aa.js`,
  coreUrl: `${publicPath}ocr/tesseract-core.wasm.2ebbac86.js`,
  langDataUrl: `${publicPath}ocr/eng.traineddata.gz`,
}));

const CASES = DOCUMENT_URLS.flatMap((documentUrl) =>
  BUNDLED_ASSETS.map((assets) => ({ documentUrl, assets })),
);

describe('resolveOcrAssetPaths', () => {
  it('returns absolute URLs on the document origin', () => {
    CASES.forEach(({ documentUrl, assets }) => {
      const paths = resolveOcrAssetPaths(documentUrl, assets);
      const { protocol } = new URL(documentUrl);
      [paths.workerPath, paths.corePath, paths.langPath].forEach((url) => {
        expect(new URL(url).protocol).toBe(protocol);
      });
    });
  });

  it('gives the worker a core path that does not depend on its own URL', () => {
    CASES.forEach(({ documentUrl, assets }) => {
      const { workerPath, corePath } = resolveOcrAssetPaths(
        documentUrl,
        assets,
      );
      // The worker calls importScripts(corePath), which resolves relative
      // paths against the worker script URL.
      expect(new URL(corePath, workerPath).href).toBe(corePath);
      expect(corePath).not.toContain('/ocr/ocr/');
      expect(corePath).toMatch(/\/ocr\/tesseract-core\.wasm\.2ebbac86\.js$/);
    });
  });

  it('documents the bug: a relative core path doubles the ocr directory', () => {
    const { workerPath } = resolveOcrAssetPaths(
      DOCUMENT_URLS[1],
      BUNDLED_ASSETS[1],
    );
    expect(new URL(BUNDLED_ASSETS[1].coreUrl, workerPath).href).toContain(
      '/ocr/ocr/',
    );
  });

  it('points langPath at the traineddata directory', () => {
    CASES.forEach(({ documentUrl, assets }) => {
      const { langPath } = resolveOcrAssetPaths(documentUrl, assets);
      expect(langPath.endsWith('/ocr/')).toBe(true);
      // tesseract.js appends `${lang}.traineddata.gz` to this directory.
      expect(new URL('eng.traineddata.gz', langPath).href).toBe(
        new URL(assets.langDataUrl, documentUrl).href,
      );
    });
  });
});

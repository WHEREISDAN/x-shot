/**
 * @jest-environment node
 */

/**
 * Bundled OCR assets are emitted with a webpack `publicPath` that is
 * relative in both configurations ('/' in dev, './' in prod). Deriving the
 * traineddata directory from such a URL requires an explicit document base;
 * `new URL('./', relativePath)` throws TypeError and silently disabled OCR
 * (and therefore PII detection) once the assets moved off the CDN.
 */
const DOCUMENT_BASES = [
  'http://localhost:1212/index.html',
  'file:///Applications/X-Shot.app/Contents/Resources/app/dist/renderer/index.html',
];

const ASSET_URLS = ['/ocr/eng.traineddata.gz', './ocr/eng.traineddata.gz'];

function resolveLangPath(assetUrl: string, documentBase: string): string {
  return new URL('.', new URL(assetUrl, documentBase)).toString();
}

describe('OCR bundled asset path resolution', () => {
  it('throws when a relative asset URL is used as a URL base', () => {
    ASSET_URLS.forEach((assetUrl) => {
      expect(() => new URL('./', assetUrl)).toThrow(/Invalid URL/);
    });
  });

  it('resolves the traineddata directory for every publicPath and base', () => {
    DOCUMENT_BASES.forEach((base) => {
      ASSET_URLS.forEach((assetUrl) => {
        const langPath = resolveLangPath(assetUrl, base);
        expect(langPath.endsWith('/ocr/')).toBe(true);
        // tesseract.js appends `${lang}.traineddata.gz` to this directory.
        expect(new URL('eng.traineddata.gz', langPath).toString()).toMatch(
          /\/ocr\/eng\.traineddata\.gz$/,
        );
      });
    });
  });
});

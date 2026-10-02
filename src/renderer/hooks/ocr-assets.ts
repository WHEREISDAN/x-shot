import workerUrl from 'tesseract.js/dist/worker.min.js';
import coreUrl from 'tesseract.js-core/tesseract-core-simd-lstm.wasm.js';
import engDataUrl from '@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz';

export interface OcrAssetUrls {
  workerUrl: string;
  coreUrl: string;
  langDataUrl: string;
}

export interface OcrAssetPaths {
  workerPath: string;
  corePath: string;
  langPath: string;
}

// Where the worker caches the decompressed language data in IndexedDB. Tied
// to the bundled data so a copy cached from other data is never reused.
export const OCR_CACHE_PATH = 'tesseract-eng-4.0.0_best_int';

const BUNDLED_OCR_ASSETS: OcrAssetUrls = {
  workerUrl,
  coreUrl,
  langDataUrl: engDataUrl,
};

/**
 * Bundled asset URLs are relative ('/ocr/...' in dev, './ocr/...' in
 * production). tesseract.js only absolutizes them in a plain browser; under
 * Electron it passes them through, and the worker then resolves the core path
 * against its own URL ('ocr/ocr/...'). Resolve every path against the
 * document so the worker receives absolute URLs.
 */
export function resolveOcrAssetPaths(
  documentUrl: string,
  assets: OcrAssetUrls = BUNDLED_OCR_ASSETS,
): OcrAssetPaths {
  const toAbsolute = (url: string) => new URL(url, documentUrl).href;
  return {
    workerPath: toAbsolute(assets.workerUrl),
    corePath: toAbsolute(assets.coreUrl),
    langPath: new URL('.', toAbsolute(assets.langDataUrl)).href,
  };
}

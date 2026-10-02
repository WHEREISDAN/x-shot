import {
  createWorker,
  OEM,
  type RecognizeResult,
  type Worker as OcrEngine,
} from 'tesseract.js';
import { createRendererLogger } from '../utils/logger';
import { OCR_CACHE_PATH, resolveOcrAssetPaths } from './ocr-assets';
import removeLegacyOcrCache from './ocr-cache';

const logger = createRendererLogger('ocr-worker');

interface OcrSession {
  engine: Promise<OcrEngine>;
  /** Rejects if the underlying Web Worker dies after it started. */
  crashed: Promise<never>;
}

let session: OcrSession | null = null;
let enginesCreated = 0;
let legacyCacheChecked = false;

function discard(target: OcrSession): void {
  if (session === target) session = null;
  target.engine.then((engine) => engine.terminate()).catch(() => {});
}

function startSession(): OcrSession {
  let reportCrash: (error: Error) => void = () => {};
  const crashed = new Promise<never>((_resolve, reject) => {
    reportCrash = reject;
  });
  crashed.catch(() => {});

  enginesCreated += 1;
  logger.info('ocr-worker-created', { count: enginesCreated });
  if (!legacyCacheChecked) {
    legacyCacheChecked = true;
    removeLegacyOcrCache().catch((error) =>
      logger.warn('Failed to remove the legacy OCR cache', error),
    );
  }

  const engine = createWorker('eng', OEM.LSTM_ONLY, {
    ...resolveOcrAssetPaths(window.location.href),
    cachePath: OCR_CACHE_PATH,
    workerBlobURL: false,
    logger: () => {},
    // Without a handler tesseract.js rethrows job errors as uncaught errors.
    errorHandler: (error: unknown) =>
      logger.warn('OCR job failed', { message: String(error) }),
  });
  const current: OcrSession = { engine, crashed };

  engine
    .then((created) => {
      // tesseract.js only watches the Web Worker while it starts up; a crash
      // later would leave jobs pending forever.
      const webWorker = (created as unknown as { worker?: EventTarget }).worker;
      webWorker?.addEventListener('error', (event) => {
        const { message } = event as ErrorEvent;
        logger.error('OCR worker crashed', { message });
        reportCrash(new Error(`OCR worker crashed: ${message}`));
        discard(current);
      });
      return created;
    })
    .catch(() => discard(current));

  return current;
}

/**
 * Recognizes text with one Web Worker shared by every capture. The worker is
 * created on first use and replaced on the next call if it fails or crashes.
 */
export async function recognizeWithSharedWorker(
  canvas: HTMLCanvasElement,
): Promise<RecognizeResult> {
  if (!session) session = startSession();
  const current = session;
  try {
    const engine = await Promise.race([current.engine, current.crashed]);
    return await Promise.race([engine.recognize(canvas), current.crashed]);
  } catch (error) {
    discard(current);
    throw error;
  }
}

export async function terminateSharedOcrWorker(): Promise<void> {
  if (!session) return;
  const current = session;
  session = null;
  await current.engine.then((engine) => engine.terminate()).catch(() => {});
}

/** How many OCR workers this window has started; for diagnostics and tests. */
export function ocrWorkersCreated(): number {
  return enginesCreated;
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => {
    terminateSharedOcrWorker().catch(() => {});
  });
}

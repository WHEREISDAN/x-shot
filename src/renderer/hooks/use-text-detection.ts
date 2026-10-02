import { useCallback, useEffect, useRef, useState } from 'react';
import { createRendererLogger } from '../utils/logger';
import { prepareOcrCanvas } from './ocr-image';
import { recognizeWithSharedWorker } from './ocr-worker';

const logger = createRendererLogger('text-detection');

// Tesseract needs glyphs roughly 10 px tall. Shrinking a 1920 px capture to
// fit 1200 px made 14 px UI text unreadable, so only captures with a long
// edge above 4096 px (5K screens) are scaled down, to bound time and memory.
export const OCR_MAX_DIMENSION = 4096;

export interface OcrBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OcrWord {
  text: string;
  bbox: OcrBox;
  confidence: number;
}

export interface OcrLine {
  text: string;
  bbox: OcrBox;
}

export interface OcrParagraph {
  text: string;
  bbox: OcrBox;
}

export type OcrStatus = 'idle' | 'running' | 'done' | 'error';

export interface UseTextDetectionResult {
  status: OcrStatus;
  error: string | null;
  words: OcrWord[];
  lines: OcrLine[];
  paragraphs: OcrParagraph[];
  /** The image the current results were computed from. */
  resultFor: string | null;
  run: () => Promise<void>;
}

function canRunOcr(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Worker !== 'undefined'
  );
}

/**
 * OCR for one capture. Runs only while `enabled` (Censor PII on or the
 * text-select tool in use), at most once per image.
 */
export function useTextDetection(
  imageDataUrl: string,
  enabled: boolean,
): UseTextDetectionResult {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<OcrWord[]>([]);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [paragraphs, setParagraphs] = useState<OcrParagraph[]>([]);
  const [resultFor, setResultFor] = useState<string | null>(null);
  // Incremented per run and on image change, so a late result for a previous
  // image is dropped instead of overwriting the current one.
  const runGenerationRef = useRef(0);
  const requestedForRef = useRef<string | null>(null);

  const run = useCallback(async () => {
    if (!imageDataUrl) return;

    runGenerationRef.current += 1;
    const generation = runGenerationRef.current;
    const isCurrent = () => runGenerationRef.current === generation;

    setStatus('running');
    setError(null);
    setWords([]);
    setLines([]);
    setParagraphs([]);
    setResultFor(null);

    let canvasCleanup: (() => void) | null = null;
    const startedAt = performance.now();

    try {
      const { canvas, scale, cleanup } = await prepareOcrCanvas(
        imageDataUrl,
        OCR_MAX_DIMENSION,
      );
      canvasCleanup = cleanup;

      const { data } = await recognizeWithSharedWorker(canvas);
      if (!isCurrent()) return;

      const invScale = scale > 0 ? 1 / scale : 1;
      const toBox = (b: {
        x0: number;
        x1: number;
        y0: number;
        y1: number;
      }): OcrBox => ({
        x: Math.round(b.x0 * invScale),
        y: Math.round(b.y0 * invScale),
        width: Math.round((b.x1 - b.x0) * invScale),
        height: Math.round((b.y1 - b.y0) * invScale),
      });

      const nextWords: OcrWord[] = (data.words || []).map((w) => ({
        text: (w.text || '').trim(),
        bbox: toBox(w.bbox),
        confidence: Number(w.confidence ?? 0),
      }));
      const nextLines: OcrLine[] = (data.lines || []).map((l) => ({
        text: (l.text || '').trim(),
        bbox: toBox(l.bbox),
      }));
      const nextParagraphs: OcrParagraph[] = (data.paragraphs || []).map(
        (p) => ({
          text: (p.text || '').trim(),
          bbox: toBox(p.bbox),
        }),
      );

      setWords(nextWords);
      setLines(nextLines);
      setParagraphs(nextParagraphs);
      setResultFor(imageDataUrl);
      setStatus('done');
      logger.info('ocr-complete', {
        durationMs: Math.round(performance.now() - startedAt),
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        words: nextWords.length,
      });
    } catch (e) {
      if (!isCurrent()) return;
      // Allow a retry when OCR is requested again for this image.
      requestedForRef.current = null;
      const message = e instanceof Error ? e.message : String(e);
      logger.error('OCR recognition failed', { message });
      setError(message);
      setStatus('error');
    } finally {
      canvasCleanup?.();
    }
  }, [imageDataUrl]);

  // A new image or unmount invalidates any run still in flight.
  useEffect(
    () => () => {
      runGenerationRef.current += 1;
    },
    [imageDataUrl],
  );

  useEffect(() => {
    if (!enabled || !canRunOcr()) return;
    if (requestedForRef.current === imageDataUrl) return;
    requestedForRef.current = imageDataUrl;
    run().catch(() => {});
  }, [enabled, imageDataUrl, run]);

  return { status, error, words, lines, paragraphs, resultFor, run };
}

import { useCallback, useEffect, useMemo, useState } from 'react';
import { recognize } from 'tesseract.js';
import workerUrl from 'tesseract.js/dist/worker.min.js';
import coreUrl from 'tesseract.js-core/tesseract-core.wasm.js';
import engDataUrl from '@tesseract.js-data/eng/4.0.0/eng.traineddata.gz';
import { createRendererLogger } from '../utils/logger';

const logger = createRendererLogger('text-detection');

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

const scannedOnce = new Set<string>();
const MAX_SCANNED_CACHE = 10; // Limit cache size

async function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = dataUrl;
  });
}

function scaleImageToCanvas(
  img: HTMLImageElement,
  maxDim: number,
): { canvas: HTMLCanvasElement; scale: number; cleanup: () => void } {
  const { naturalWidth, naturalHeight } = img;
  const maxInput = Math.max(naturalWidth, naturalHeight);
  const scale = maxInput > maxDim ? maxDim / maxInput : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    0,
    0,
    naturalWidth,
    naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const cleanup = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  };

  return { canvas, scale, cleanup };
}

function manageCacheSize() {
  if (scannedOnce.size > MAX_SCANNED_CACHE) {
    const entries = Array.from(scannedOnce);
    const toRemove = entries.slice(0, entries.length - MAX_SCANNED_CACHE);
    toRemove.forEach((entry) => scannedOnce.delete(entry));
  }
}

export interface UseTextDetectionResult {
  status: OcrStatus;
  error: string | null;
  words: OcrWord[];
  lines: OcrLine[];
  paragraphs: OcrParagraph[];
  run: () => Promise<void>;
  hasRunOnce: boolean;
}

export function useTextDetection(imageDataUrl: string): UseTextDetectionResult {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<OcrWord[]>([]);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [paragraphs, setParagraphs] = useState<OcrParagraph[]>([]);

  const hasRunOnce = useMemo(
    () => scannedOnce.has(imageDataUrl),
    [imageDataUrl],
  );

  const run = useCallback(async () => {
    if (!imageDataUrl) return;

    setStatus('running');
    setError(null);

    let img: HTMLImageElement | null = null;
    let canvasCleanup: (() => void) | null = null;

    try {
      img = await loadImage(imageDataUrl);
      const { canvas, scale, cleanup } = scaleImageToCanvas(img, 1200);
      canvasCleanup = cleanup;

      // Bundled asset URLs are relative (dev: '/ocr/...', prod: './ocr/...'),
      // so they must be resolved against the document before taking their
      // directory; `new URL('./', relativePath)` throws.
      const langPath = new URL(
        '.',
        new URL(engDataUrl, window.location.href),
      ).toString();
      const localOcrOptions = {
        workerPath: workerUrl,
        corePath: coreUrl,
        langPath,
        workerBlobURL: false,
        logger: () => {},
      } as const;

      const { data } = await recognize(canvas, 'eng', localOcrOptions);

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
      scannedOnce.add(imageDataUrl);
      manageCacheSize();

      setStatus('done');
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logger.error('OCR recognition failed', { message });
      setError(message);
      setStatus('error');
    } finally {
      canvasCleanup?.();
      img = null;
    }
  }, [imageDataUrl]);

  useEffect(() => {
    if (
      typeof process !== 'undefined' &&
      process.env &&
      process.env.NODE_ENV === 'test'
    ) {
      return;
    }
    if (
      typeof window === 'undefined' ||
      typeof document === 'undefined' ||
      typeof Worker === 'undefined'
    ) {
      return;
    }
    if (!scannedOnce.has(imageDataUrl)) {
      run().catch(() => {});
    }
  }, [imageDataUrl, run]);

  return { status, error, words, lines, paragraphs, run, hasRunOnce };
}

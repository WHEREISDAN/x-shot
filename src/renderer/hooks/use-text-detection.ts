import { useCallback, useEffect, useRef, useState } from 'react';
import { recognize } from 'tesseract.js';
import { createRendererLogger } from '../utils/logger';
import { resolveOcrAssetPaths } from './ocr-assets';
import { prepareOcrCanvas } from './ocr-image';

const logger = createRendererLogger('text-detection');

const OCR_MAX_DIMENSION = 1200;

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
  run: () => Promise<void>;
}

function canRunOcr(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof Worker !== 'undefined'
  );
}

export function useTextDetection(imageDataUrl: string): UseTextDetectionResult {
  const [status, setStatus] = useState<OcrStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<OcrWord[]>([]);
  const [lines, setLines] = useState<OcrLine[]>([]);
  const [paragraphs, setParagraphs] = useState<OcrParagraph[]>([]);
  // Incremented per run and on image change, so a late result for a previous
  // image is dropped instead of overwriting the current one.
  const runGenerationRef = useRef(0);

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

    let canvasCleanup: (() => void) | null = null;

    try {
      const { canvas, scale, cleanup } = await prepareOcrCanvas(
        imageDataUrl,
        OCR_MAX_DIMENSION,
      );
      canvasCleanup = cleanup;

      const localOcrOptions = {
        ...resolveOcrAssetPaths(window.location.href),
        workerBlobURL: false,
        logger: () => {},
      } as const;

      const { data } = await recognize(canvas, 'eng', localOcrOptions);
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
      setStatus('done');
    } catch (e) {
      if (!isCurrent()) return;
      const message = e instanceof Error ? e.message : String(e);
      logger.error('OCR recognition failed', { message });
      setError(message);
      setStatus('error');
    } finally {
      canvasCleanup?.();
    }
  }, [imageDataUrl]);

  useEffect(() => {
    if (!canRunOcr()) return undefined;
    run().catch(() => {});
    return () => {
      runGenerationRef.current += 1;
    };
  }, [run]);

  return { status, error, words, lines, paragraphs, run };
}

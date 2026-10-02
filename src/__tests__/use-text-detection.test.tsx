import { act, renderHook, waitFor } from '@testing-library/react';
import type { RecognizeResult } from 'tesseract.js';
import { prepareOcrCanvas } from '../renderer/hooks/ocr-image';
import { recognizeWithSharedWorker } from '../renderer/hooks/ocr-worker';
import {
  OCR_MAX_DIMENSION,
  useTextDetection,
} from '../renderer/hooks/use-text-detection';

jest.mock('../renderer/hooks/ocr-worker', () => ({
  recognizeWithSharedWorker: jest.fn(),
}));
jest.mock('../renderer/hooks/ocr-image', () => ({
  prepareOcrCanvas: jest.fn(),
}));

const mockedRecognize = recognizeWithSharedWorker as jest.MockedFunction<
  typeof recognizeWithSharedWorker
>;
const mockedPrepareOcrCanvas = prepareOcrCanvas as jest.MockedFunction<
  typeof prepareOcrCanvas
>;

const IMAGE_A = 'data:image/png;base64,QUFBQQ==';
const IMAGE_B = 'data:image/png;base64,QkJCQg==';

function ocrResult(text: string): RecognizeResult {
  const bbox = { x0: 10, y0: 20, x1: 110, y1: 40 };
  return {
    data: {
      words: [{ text, bbox, confidence: 90 }],
      lines: [{ text, bbox }],
      paragraphs: [{ text, bbox }],
    },
  } as unknown as RecognizeResult;
}

function deferred<T>() {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
}

const wordTexts = (words: { text: string }[]) => words.map((w) => w.text);

type HookProps = { url: string; enabled: boolean };

describe('useTextDetection', () => {
  beforeAll(() => {
    // jsdom has no Worker; the hook only runs OCR where workers exist.
    Object.defineProperty(window, 'Worker', {
      value: class {},
      configurable: true,
      writable: true,
    });
  });

  afterAll(() => {
    delete (window as { Worker?: unknown }).Worker;
  });

  beforeEach(() => {
    mockedRecognize.mockReset();
    mockedPrepareOcrCanvas.mockReset();
    mockedPrepareOcrCanvas.mockResolvedValue({
      canvas: document.createElement('canvas'),
      scale: 1,
      cleanup: jest.fn(),
    });
  });

  it('does nothing until OCR is wanted, then runs once per image', async () => {
    mockedRecognize.mockResolvedValue(ocrResult('jane@example.com'));
    const { result, rerender } = renderHook(
      ({ url, enabled }: HookProps) => useTextDetection(url, enabled),
      { initialProps: { url: IMAGE_A, enabled: false } },
    );
    await act(async () => {});
    expect(result.current.status).toBe('idle');
    expect(mockedRecognize).not.toHaveBeenCalled();

    rerender({ url: IMAGE_A, enabled: true });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(result.current.resultFor).toBe(IMAGE_A);

    // Turning OCR off and on again reuses the result for the same image.
    rerender({ url: IMAGE_A, enabled: false });
    rerender({ url: IMAGE_A, enabled: true });
    await act(async () => {});
    expect(mockedRecognize).toHaveBeenCalledTimes(1);
    expect(wordTexts(result.current.words)).toEqual(['jane@example.com']);
  });

  it('keeps full resolution up to the 4096 px long-edge limit', async () => {
    mockedRecognize.mockResolvedValue(ocrResult('x'));
    renderHook(() => useTextDetection(IMAGE_A, true));
    await waitFor(() => expect(mockedRecognize).toHaveBeenCalled());

    expect(OCR_MAX_DIMENSION).toBe(4096);
    expect(mockedPrepareOcrCanvas).toHaveBeenCalledWith(IMAGE_A, 4096);
  });

  it('runs OCR again for a pixel-identical capture in a new editor', async () => {
    mockedRecognize.mockResolvedValue(ocrResult('jane@example.com'));

    const first = renderHook(() => useTextDetection(IMAGE_A, true));
    await waitFor(() => expect(first.result.current.status).toBe('done'));
    first.unmount();

    const second = renderHook(() => useTextDetection(IMAGE_A, true));
    await waitFor(() => expect(second.result.current.status).toBe('done'));

    expect(mockedRecognize).toHaveBeenCalledTimes(2);
  });

  it('retries after a failure when OCR is requested again', async () => {
    mockedRecognize
      .mockRejectedValueOnce(new Error('OCR worker crashed'))
      .mockResolvedValueOnce(ocrResult('second try'));
    const { result, rerender } = renderHook(
      ({ url, enabled }: HookProps) => useTextDetection(url, enabled),
      { initialProps: { url: IMAGE_A, enabled: true } },
    );
    await waitFor(() => expect(result.current.status).toBe('error'));

    rerender({ url: IMAGE_A, enabled: false });
    rerender({ url: IMAGE_A, enabled: true });
    await waitFor(() => expect(result.current.status).toBe('done'));
    expect(wordTexts(result.current.words)).toEqual(['second try']);
  });

  it('clears results per image and drops a late result for the old image', async () => {
    const runA = deferred<RecognizeResult>();
    const runB = deferred<RecognizeResult>();
    mockedRecognize
      .mockImplementationOnce(() => runA.promise)
      .mockImplementationOnce(() => runB.promise);

    const { result, rerender } = renderHook(
      ({ url, enabled }: HookProps) => useTextDetection(url, enabled),
      { initialProps: { url: IMAGE_A, enabled: true } },
    );
    await waitFor(() => expect(mockedRecognize).toHaveBeenCalledTimes(1));

    rerender({ url: IMAGE_B, enabled: true });
    await waitFor(() => expect(mockedRecognize).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('running');
    expect(result.current.words).toEqual([]);

    await act(async () => runA.resolve(ocrResult('from-image-a')));
    expect(result.current.status).toBe('running');
    expect(result.current.words).toEqual([]);

    await act(async () => runB.resolve(ocrResult('from-image-b')));
    expect(result.current.status).toBe('done');
    expect(result.current.resultFor).toBe(IMAGE_B);
    expect(wordTexts(result.current.words)).toEqual(['from-image-b']);
  });
});

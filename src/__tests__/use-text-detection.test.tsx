import { act, renderHook, waitFor } from '@testing-library/react';
import { recognize } from 'tesseract.js';
import { prepareOcrCanvas } from '../renderer/hooks/ocr-image';
import { useTextDetection } from '../renderer/hooks/use-text-detection';

jest.mock('tesseract.js', () => ({ recognize: jest.fn() }));
jest.mock('../renderer/hooks/ocr-image', () => ({
  prepareOcrCanvas: jest.fn(),
}));

type RecognizeResult = Awaited<ReturnType<typeof recognize>>;

const mockedRecognize = recognize as jest.MockedFunction<typeof recognize>;
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

  it('runs OCR again for a pixel-identical capture in a new editor', async () => {
    mockedRecognize.mockResolvedValue(ocrResult('jane@example.com'));

    const first = renderHook(() => useTextDetection(IMAGE_A));
    await waitFor(() => expect(first.result.current.status).toBe('done'));
    first.unmount();

    const second = renderHook(() => useTextDetection(IMAGE_A));
    await waitFor(() => expect(second.result.current.status).toBe('done'));

    expect(mockedRecognize).toHaveBeenCalledTimes(2);
    expect(wordTexts(second.result.current.words)).toEqual([
      'jane@example.com',
    ]);
  });

  it('clears results per image and drops a late result for the old image', async () => {
    const runA = deferred<RecognizeResult>();
    const runB = deferred<RecognizeResult>();
    mockedRecognize
      .mockImplementationOnce(
        () => runA.promise as ReturnType<typeof recognize>,
      )
      .mockImplementationOnce(
        () => runB.promise as ReturnType<typeof recognize>,
      );

    const { result, rerender } = renderHook(
      ({ url }) => useTextDetection(url),
      { initialProps: { url: IMAGE_A } },
    );
    await waitFor(() => expect(mockedRecognize).toHaveBeenCalledTimes(1));

    rerender({ url: IMAGE_B });
    await waitFor(() => expect(mockedRecognize).toHaveBeenCalledTimes(2));
    expect(result.current.status).toBe('running');
    expect(result.current.words).toEqual([]);

    await act(async () => runA.resolve(ocrResult('from-image-a')));
    expect(result.current.status).toBe('running');
    expect(result.current.words).toEqual([]);

    await act(async () => runB.resolve(ocrResult('from-image-b')));
    expect(result.current.status).toBe('done');
    expect(wordTexts(result.current.words)).toEqual(['from-image-b']);
  });
});

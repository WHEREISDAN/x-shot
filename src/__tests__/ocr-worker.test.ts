import { createWorker, type RecognizeResult } from 'tesseract.js';
import {
  ocrWorkersCreated,
  recognizeWithSharedWorker,
  terminateSharedOcrWorker,
} from '../renderer/hooks/ocr-worker';

jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(),
  OEM: { LSTM_ONLY: 1 },
}));

type FakeEngine = {
  recognize: jest.Mock;
  terminate: jest.Mock;
  worker: EventTarget;
};

const mockedCreateWorker = createWorker as jest.MockedFunction<
  typeof createWorker
>;
const RESULT = { data: { words: [] } } as unknown as RecognizeResult;

function fakeEngine(): FakeEngine {
  return {
    recognize: jest.fn(async () => RESULT),
    terminate: jest.fn(async () => undefined),
    worker: new EventTarget(),
  };
}

const canvas = () => document.createElement('canvas');

describe('shared OCR worker', () => {
  let engines: FakeEngine[];

  beforeEach(async () => {
    await terminateSharedOcrWorker();
    engines = [];
    mockedCreateWorker.mockReset();
    mockedCreateWorker.mockImplementation(async () => {
      const engine = fakeEngine();
      engines.push(engine);
      return engine as unknown as Awaited<ReturnType<typeof createWorker>>;
    });
  });

  it('creates one worker on first use and reuses it for later captures', async () => {
    expect(mockedCreateWorker).not.toHaveBeenCalled();
    const before = ocrWorkersCreated();

    await recognizeWithSharedWorker(canvas());
    await recognizeWithSharedWorker(canvas());
    await recognizeWithSharedWorker(canvas());

    expect(mockedCreateWorker).toHaveBeenCalledTimes(1);
    expect(ocrWorkersCreated() - before).toBe(1);
    expect(engines[0].recognize).toHaveBeenCalledTimes(3);
  });

  it('passes absolute asset paths and a versioned cache path', async () => {
    await recognizeWithSharedWorker(canvas());
    const options = mockedCreateWorker.mock.calls[0][2] as Record<
      string,
      unknown
    >;
    expect(String(options.workerPath)).toMatch(/^http:\/\/localhost\//);
    expect(String(options.corePath)).toMatch(/^http:\/\/localhost\//);
    expect(options.cachePath).toMatch(/^tesseract-eng-/);
    expect(typeof options.errorHandler).toBe('function');
  });

  it('recreates the worker on the next use after it crashes', async () => {
    await recognizeWithSharedWorker(canvas());
    const [first] = engines;
    first.recognize.mockImplementationOnce(() => new Promise(() => {}));

    const pending = recognizeWithSharedWorker(canvas());
    await Promise.resolve();
    first.worker.dispatchEvent(
      new ErrorEvent('error', { message: 'RuntimeError: unreachable' }),
    );
    await expect(pending).rejects.toThrow('OCR worker crashed');
    expect(first.terminate).toHaveBeenCalled();

    await recognizeWithSharedWorker(canvas());
    expect(mockedCreateWorker).toHaveBeenCalledTimes(2);
    expect(engines[1].recognize).toHaveBeenCalledTimes(1);
  });

  it('retries creation when the worker fails to start', async () => {
    mockedCreateWorker.mockRejectedValueOnce(new Error('load failed'));
    await expect(recognizeWithSharedWorker(canvas())).rejects.toThrow(
      'load failed',
    );

    await expect(recognizeWithSharedWorker(canvas())).resolves.toBe(RESULT);
    expect(mockedCreateWorker).toHaveBeenCalledTimes(2);
  });

  it('terminates the worker when the window goes away', async () => {
    await recognizeWithSharedWorker(canvas());
    window.dispatchEvent(new Event('pagehide'));
    await Promise.resolve();
    await Promise.resolve();

    expect(engines[0].terminate).toHaveBeenCalled();
  });
});

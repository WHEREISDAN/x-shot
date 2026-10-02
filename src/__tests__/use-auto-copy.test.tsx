import { act, renderHook, waitFor } from '@testing-library/react';
import {
  useAutoCopy,
  type UseAutoCopyParams,
} from '../renderer/hooks/use-auto-copy';
import fetchImageBytes from '../renderer/utils/image-url';

// Reading the capture asset needs main's protocol; the test serves RAW.
jest.mock('../renderer/utils/image-url', () => ({
  __esModule: true,
  default: jest.fn(async () => new Uint8Array([1, 2, 3])),
}));

const RAW_URL = 'xshot-asset://capture/0b7c2d4e-1f3a-4b5c-8d6e-7f8091a2b3c4';
const RAW = new Uint8Array([1, 2, 3]);
const REDACTED = new Uint8Array([4, 5, 6]);

let autoCopyToClipboard = true;
const log = jest.fn();

function params(overrides: Partial<UseAutoCopyParams>): UseAutoCopyParams {
  return {
    rawImageUrl: RAW_URL,
    censorPII: false,
    piiPreferencesLoaded: true,
    piiStatus: 'ready',
    exportRedacted: jest.fn(async () => REDACTED),
    copy: jest.fn(async () => true),
    ...overrides,
  };
}

// Lets the preference request and any copy promise settle.
const settle = () =>
  act(async () => {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 0);
    });
  });

describe('useAutoCopy', () => {
  beforeEach(() => {
    autoCopyToClipboard = true;
    log.mockClear();
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: {
        invoke: jest.fn(async () => ({ capture: { autoCopyToClipboard } })),
        log,
      },
    };
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  it('copies the raw capture when Censor PII is off', async () => {
    const props = params({});
    renderHook(() => useAutoCopy(props));

    await waitFor(() => expect(props.copy).toHaveBeenCalledWith(RAW));
    expect(fetchImageBytes).toHaveBeenCalledWith(RAW_URL);
    expect(props.exportRedacted).not.toHaveBeenCalled();
  });

  it('waits for the PII layer and copies only the redacted export', async () => {
    const copy = jest.fn(async () => true);
    const exportRedacted = jest.fn(async () => REDACTED);
    const { rerender } = renderHook(
      (props: UseAutoCopyParams) => useAutoCopy(props),
      {
        initialProps: params({
          censorPII: true,
          piiStatus: 'pending',
          copy,
          exportRedacted,
        }),
      },
    );
    await settle();
    expect(copy).not.toHaveBeenCalled();

    rerender(
      params({ censorPII: true, piiStatus: 'ready', copy, exportRedacted }),
    );
    await waitFor(() => expect(copy).toHaveBeenCalledWith(REDACTED));
    rerender(
      params({ censorPII: true, piiStatus: 'ready', copy, exportRedacted }),
    );
    await settle();

    expect(copy).toHaveBeenCalledTimes(1);
    expect(copy).not.toHaveBeenCalledWith(RAW);
  });

  it('copies the export with manual masks and logs when OCR fails', async () => {
    const props = params({ censorPII: true, piiStatus: 'ocr-failed' });
    renderHook(() => useAutoCopy(props));

    await waitFor(() => expect(props.copy).toHaveBeenCalledWith(REDACTED));
    expect(log).toHaveBeenCalledWith(
      expect.objectContaining({
        level: 'warn',
        message: expect.stringContaining('OCR failed'),
      }),
    );
  });

  it('never copies before PII preferences load', async () => {
    const props = params({ piiPreferencesLoaded: false });
    renderHook(() => useAutoCopy(props));
    await settle();

    expect(props.copy).not.toHaveBeenCalled();
  });

  it('does nothing when auto-copy is off', async () => {
    autoCopyToClipboard = false;
    const props = params({});
    renderHook(() => useAutoCopy(props));
    await settle();

    expect(props.copy).not.toHaveBeenCalled();
    expect(props.exportRedacted).not.toHaveBeenCalled();
  });
});

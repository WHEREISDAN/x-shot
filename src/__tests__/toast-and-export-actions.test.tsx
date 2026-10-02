import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import Toast from '../renderer/components/Toast';
import {
  SUCCESS_TOAST_MS,
  useExportActions,
} from '../renderer/hooks/use-export-actions';

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

describe('Toast', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('dismisses a success message after its delay', () => {
    const onDismiss = jest.fn();
    render(
      <Toast
        tone="success"
        message="Copied to the clipboard."
        onDismiss={onDismiss}
        autoDismissMs={SUCCESS_TOAST_MS}
      />,
    );
    expect(screen.getByRole('status')).toHaveTextContent('Copied');

    act(() => jest.advanceTimersByTime(SUCCESS_TOAST_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => jest.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps an error until it is dismissed', () => {
    const onDismiss = jest.fn();
    render(<Toast tone="error" message="Disk full" onDismiss={onDismiss} />);

    act(() => jest.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert')).toHaveTextContent('Disk full');
    expect(onDismiss).not.toHaveBeenCalled();
  });
});

describe('useExportActions', () => {
  const invoke = jest.fn();

  beforeEach(() => {
    invoke.mockReset();
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: { invoke, log: jest.fn() },
    };
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  async function run<T>(
    action: (actions: ReturnType<typeof useExportActions>) => Promise<T>,
  ) {
    const { result } = renderHook(() => useExportActions());
    let value: T | undefined;
    await act(async () => {
      value = await action(result.current);
    });
    return { notice: result.current.notice, value };
  }

  it('reports a copy that worked and one that failed', async () => {
    invoke.mockResolvedValueOnce({ ok: true });
    const copied = await run((a) => a.copy(PNG));
    expect(copied.value).toBe(true);
    expect(copied.notice).toMatchObject({ tone: 'success' });

    invoke.mockResolvedValueOnce({ ok: false, error: 'Clipboard busy' });
    const failed = await run((a) => a.copy(PNG));
    expect(failed.value).toBe(false);
    expect(failed.notice).toMatchObject({
      tone: 'error',
      message: expect.stringContaining('Clipboard busy'),
    });
  });

  it.each([
    [
      { status: 'saved', filePath: '/tmp/shot.png' },
      'success',
      '/tmp/shot.png',
    ],
    [{ status: 'failed', error: 'EACCES' }, 'error', 'EACCES'],
  ])('reports the save result %j', async (response, tone, text) => {
    invoke.mockResolvedValueOnce(response);
    const { notice } = await run((a) => a.save(PNG));
    expect(notice).toMatchObject({
      tone,
      message: expect.stringContaining(text),
    });
  });

  it('stays quiet when the save dialog is canceled', async () => {
    invoke.mockResolvedValueOnce({ status: 'canceled' });
    const { notice } = await run((a) => a.save(PNG));
    expect(notice).toBeNull();
  });

  it('reports IPC errors and export rendering errors', async () => {
    invoke.mockRejectedValueOnce(new Error('IPC closed'));
    const saved = await run((a) => a.save(PNG));
    expect(saved.notice?.message).toContain('IPC closed');

    const { result } = renderHook(() => useExportActions());
    act(() => result.current.reportExportError('copy', new Error('canvas')));
    expect(result.current.notice).toMatchObject({
      tone: 'error',
      message: "Couldn't copy the screenshot: canvas",
    });
  });
});

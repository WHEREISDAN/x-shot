/**
 * @jest-environment node
 */
import { ipcMain } from 'electron';
import log from 'electron-log';
import registerLogIpcHandler, { toRendererLogEntry } from '../main/ipc/log';
import { sanitizeLogMessage, sanitizeLogValue } from '../main/log-sanitize';

jest.mock('electron', () => ({ ipcMain: { on: jest.fn() } }));
jest.mock('electron-log', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const DATA_URL = 'data:image/png;base64,QUJDREVGR0g=';

afterEach(() => jest.clearAllMocks());

describe('sanitizeLogMessage', () => {
  it('redacts data URLs but keeps the rest of the message', () => {
    expect(sanitizeLogMessage(`copied ${DATA_URL} to the clipboard`)).toBe(
      `copied [redacted:len=${DATA_URL.length}] to the clipboard`,
    );
  });

  it('caps long messages', () => {
    const out = sanitizeLogMessage('x'.repeat(5000));
    expect(out.length).toBeLessThan(1100);
    expect(out).toContain('[truncated:len=5000]');
  });
});

describe('sanitizeLogValue', () => {
  it('redacts data URLs and long strings at any depth', () => {
    expect(
      sanitizeLogValue({
        image: DATA_URL,
        nested: { text: 'y'.repeat(300), ok: 'short' },
        list: [DATA_URL],
      }),
    ).toEqual({
      image: `[redacted:len=${DATA_URL.length}]`,
      nested: { text: '[redacted:len=300]', ok: 'short' },
      list: [`[redacted:len=${DATA_URL.length}]`],
    });
  });

  it('survives cycles and keeps shared objects', () => {
    const shared = { ok: true };
    const cyclic: Record<string, unknown> = { a: shared, b: shared };
    cyclic.self = cyclic;
    expect(sanitizeLogValue(cyclic)).toEqual({
      a: { ok: true },
      b: { ok: true },
      self: '[circular]',
    });
  });

  it('keeps the name and message of errors', () => {
    expect(sanitizeLogValue(new TypeError(`bad ${DATA_URL}`))).toEqual({
      name: 'TypeError',
      message: `bad [redacted:len=${DATA_URL.length}]`,
    });
  });
});

describe('renderer log sink', () => {
  it('writes a sanitized entry at the requested level', () => {
    registerLogIpcHandler();
    const sink = (ipcMain.on as jest.Mock).mock.calls.find(
      ([channel]) => channel === 'log',
    )[1];
    sink(
      {},
      {
        level: 'warn',
        scope: 'ocr',
        message: `found ${DATA_URL}`,
        meta: { text: 'z'.repeat(400) },
      },
    );
    expect(log.warn).toHaveBeenCalledWith(
      `[ocr] found [redacted:len=${DATA_URL.length}]`,
      { text: '[redacted:len=400]' },
    );
  });

  it.each([null, 'hello', 42, { level: 'info' }, { message: 7 }])(
    'ignores the malformed payload %j',
    (payload) => {
      expect(toRendererLogEntry(payload)).toBeNull();
    },
  );

  it('falls back to info for an unknown level and drops odd scopes', () => {
    expect(
      toRendererLogEntry({
        level: 'fatal',
        scope: 'x'.repeat(100),
        message: 'hi',
      }),
    ).toEqual({ level: 'info', text: 'hi', meta: '' });
  });
});

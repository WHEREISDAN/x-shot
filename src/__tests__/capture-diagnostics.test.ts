/**
 * @jest-environment node
 */
import log from 'electron-log';
import {
  beginCaptureSession,
  endCaptureSession,
  getActiveCaptureSessionId,
  markCaptureStage,
  sanitizeDiagnosticsMeta,
} from '../main/capture-diagnostics';

jest.mock('electron-log', () => ({
  transports: {
    file: { level: 'info' },
    console: { level: 'info' },
  },
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const infoMock = log.info as jest.Mock;

function loggedMetas(): Array<Record<string, unknown>> {
  return infoMock.mock.calls.map((call) => call[1]);
}

describe('capture diagnostics sessions', () => {
  beforeEach(() => {
    endCaptureSession('canceled');
    infoMock.mockClear();
  });

  it('generates unique session ids', () => {
    const first = beginCaptureSession('capture');
    endCaptureSession('completed');
    const second = beginCaptureSession('capture');
    endCaptureSession('completed');
    expect(first).not.toEqual(second);
  });

  it('tracks the active session id and clears it on end', () => {
    expect(getActiveCaptureSessionId()).toBeNull();
    const id = beginCaptureSession('capture');
    expect(getActiveCaptureSessionId()).toBe(id);
    endCaptureSession('completed');
    expect(getActiveCaptureSessionId()).toBeNull();
  });

  it('emits monotonic tMs across stages with the same session id', () => {
    const id = beginCaptureSession('capture');
    markCaptureStage('trigger');
    markCaptureStage('snapshot-ready');
    markCaptureStage('editor-sent');
    endCaptureSession('completed');

    const stageMetas = loggedMetas().filter(
      (meta) => meta && meta.stage !== undefined,
    );
    expect(stageMetas).toHaveLength(3);
    stageMetas.forEach((meta) => expect(meta.sessionId).toBe(id));
    const times = stageMetas.map((meta) => meta.tMs as number);
    const sorted = [...times].sort((a, b) => a - b);
    expect(times).toEqual(sorted);
    stageMetas.forEach((meta) =>
      expect(meta.dtMs as number).toBeGreaterThanOrEqual(0),
    );
  });

  it('lazily begins an unknown session when marking without one', () => {
    expect(getActiveCaptureSessionId()).toBeNull();
    markCaptureStage('selection-confirmed');
    expect(getActiveCaptureSessionId()).not.toBeNull();
    endCaptureSession('completed');
  });

  it('never logs raw data URLs passed as stage metadata', () => {
    beginCaptureSession('capture');
    markCaptureStage('editor-sent', {
      dataUrl: 'data:image/png;base64,AAAA',
    });
    endCaptureSession('completed');

    const serialized = JSON.stringify(infoMock.mock.calls);
    expect(serialized).not.toContain('base64,AAAA');
  });
});

describe('sanitizeDiagnosticsMeta', () => {
  it('redacts data URLs', () => {
    const out = sanitizeDiagnosticsMeta({ img: 'data:image/png;base64,AAAA' });
    expect(out.img).toBe('[redacted:len=26]');
  });

  it('redacts strings longer than 256 characters', () => {
    const long = 'x'.repeat(300);
    const out = sanitizeDiagnosticsMeta({ text: long });
    expect(out.text).toBe('[redacted:len=300]');
  });

  it('passes numbers, rects, and short strings through', () => {
    const meta = {
      displayId: 1,
      scaleFactor: 2,
      platform: 'darwin',
      cropRect: { x: 100, y: 100, width: 400, height: 300 },
    };
    expect(sanitizeDiagnosticsMeta(meta)).toEqual(meta);
  });

  it('sanitizes nested objects and arrays', () => {
    const out = sanitizeDiagnosticsMeta({
      displays: [{ displayId: 1, preview: 'data:image/png;base64,BBBB' }],
    });
    expect(out).toEqual({
      displays: [{ displayId: 1, preview: '[redacted:len=26]' }],
    });
  });
});

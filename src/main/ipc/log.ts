import { ipcMain } from 'electron';
import log from 'electron-log';
import type { LogLevel } from '../../shared/ipc-types';
import { sanitizeLogMessage, sanitizeLogValue } from '../log-sanitize';

const LEVELS: readonly LogLevel[] = ['debug', 'info', 'warn', 'error'];
const MAX_SCOPE_LENGTH = 64;

export interface RendererLogEntry {
  level: LogLevel;
  text: string;
  meta: unknown;
}

/**
 * A renderer's log message as it may be written to the log file, or null if
 * the payload is not a log message. Data URLs, long strings and OCR text are
 * redacted the same way capture diagnostics are.
 */
export function toRendererLogEntry(payload: unknown): RendererLogEntry | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { level, message, scope, meta } = payload as Record<string, unknown>;
  if (typeof message !== 'string') return null;
  const safeScope =
    typeof scope === 'string' &&
    scope.length > 0 &&
    scope.length <= MAX_SCOPE_LENGTH
      ? `[${scope}] `
      : '';
  return {
    level: LEVELS.includes(level as LogLevel) ? (level as LogLevel) : 'info',
    text: safeScope + sanitizeLogMessage(message),
    meta: meta === undefined || meta === null ? '' : sanitizeLogValue(meta),
  };
}

/** The renderer-to-main logging sink. */
export default function registerLogIpcHandler(): void {
  ipcMain.on('log', (_event, payload: unknown) => {
    const entry = toRendererLogEntry(payload);
    if (entry) log[entry.level](entry.text, entry.meta);
  });
}

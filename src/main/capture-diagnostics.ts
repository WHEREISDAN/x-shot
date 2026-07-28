import { randomUUID } from 'crypto';
import { getLogger } from './logger';

export type CaptureStage =
  | 'trigger'
  | 'snapshot-ready'
  | 'overlay-visible'
  | 'selection-confirmed'
  | 'editor-sent'
  | 'export-copy'
  | 'export-save';

export type CaptureTrigger =
  | 'capture'
  | 'recapture'
  | 'hotkey'
  | 'tray'
  | 'delayed'
  | 'renderer'
  | 'unknown';
export type CaptureOutcome = 'completed' | 'canceled' | 'error';

interface ActiveSession {
  sessionId: string;
  trigger: CaptureTrigger;
  startedAt: number;
  lastMarkAt: number;
}

const MAX_META_STRING_LENGTH = 256;

const logger = getLogger('capture');

let activeSession: ActiveSession | null = null;

function redact(value: string): string {
  return `[redacted:len=${value.length}]`;
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('data:') || value.length > MAX_META_STRING_LENGTH) {
      return redact(value);
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    Object.entries(value as Record<string, unknown>).forEach(([key, inner]) => {
      out[key] = sanitizeValue(inner);
    });
    return out;
  }
  return value;
}

/**
 * Strips anything that could contain screenshot bytes, data URLs, OCR text,
 * or PII from diagnostics metadata. Strings starting with `data:` or longer
 * than 256 characters are replaced with a length marker.
 */
export function sanitizeDiagnosticsMeta(
  meta: Record<string, unknown>,
): Record<string, unknown> {
  return sanitizeValue(meta) as Record<string, unknown>;
}

export function getActiveCaptureSessionId(): string | null {
  return activeSession?.sessionId ?? null;
}

export function beginCaptureSession(
  trigger: CaptureTrigger,
  explicitSessionId?: string,
): string {
  const now = performance.now();
  const sessionId = explicitSessionId ?? randomUUID();
  if (activeSession) {
    logger.warn('capture-session-replaced', {
      sessionId: activeSession.sessionId,
      replacedBy: sessionId,
    });
  }
  activeSession = { sessionId, trigger, startedAt: now, lastMarkAt: now };
  logger.info('capture-session-begin', { sessionId, trigger });
  return sessionId;
}

export function markCaptureStage(
  stage: CaptureStage,
  meta?: Record<string, unknown>,
): void {
  if (!activeSession) {
    beginCaptureSession('unknown');
  }
  const session = activeSession as ActiveSession;
  const now = performance.now();
  const tMs = Math.round(now - session.startedAt);
  const dtMs = Math.round(now - session.lastMarkAt);
  session.lastMarkAt = now;
  logger.info('capture-stage', {
    sessionId: session.sessionId,
    stage,
    tMs,
    dtMs,
    ...(meta ? sanitizeDiagnosticsMeta(meta) : {}),
  });
}

export function endCaptureSession(outcome: CaptureOutcome): void {
  if (!activeSession) return;
  const totalMs = Math.round(performance.now() - activeSession.startedAt);
  logger.info('capture-session-end', {
    sessionId: activeSession.sessionId,
    trigger: activeSession.trigger,
    outcome,
    totalMs,
  });
  activeSession = null;
}

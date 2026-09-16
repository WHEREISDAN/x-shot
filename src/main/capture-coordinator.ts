/**
 * Capture session coordinator. Owns the capture lifecycle state machine:
 *
 *   idle -> preparing -> selecting -> committing -> idle
 *                              \-> canceling -> idle
 *
 * The coordinator is electron-free; the actual capture work (snapshots,
 * overlay windows, cropping, delivery) is injected as hooks so the state
 * machine is unit-testable. Exactly one session can be active at a time;
 * every session carries a unique id and a monotonically increasing
 * generation token that lets in-flight async work detect it has gone stale.
 */

export type CaptureState =
  | 'idle'
  | 'preparing'
  | 'selecting'
  | 'committing'
  | 'canceling';

export type CaptureSource =
  | 'hotkey'
  | 'tray'
  | 'menu'
  | 'delayed'
  | 'renderer'
  | 'recapture'
  | 'unknown';

export type CancelReason =
  | 'escape'
  | 'replaced'
  | 'display-changed'
  | 'app-quit'
  | 'renderer-crash'
  | 'prepare-failed'
  | 'unknown';

export type SessionOutcome = 'completed' | 'canceled' | 'error';

export interface CaptureRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CaptureSessionRef {
  id: string;
  generation: number;
  source: CaptureSource;
}

/** What a confirmed session delivers to the editor. */
export type CaptureCommitPayload =
  | { kind: 'selection'; rect: CaptureRect }
  | { kind: 'window'; sourceId: string }
  | { kind: 'screen'; sourceId?: string; displayId?: number | string };

export interface CaptureCoordinatorHooks {
  /** Acquire snapshots and show selection overlays. */
  prepare(session: CaptureSessionRef): Promise<void>;
  /** Acquire the final image and deliver it to the editor. */
  commit(
    session: CaptureSessionRef,
    payload: CaptureCommitPayload,
  ): Promise<void>;
  /** Tear down overlays and release session assets. */
  cleanup(session: CaptureSessionRef, reason: CancelReason): Promise<void>;
}

export interface CaptureCoordinatorObserver {
  onSessionStart?(session: CaptureSessionRef): void;
  onSessionEnd?(session: CaptureSessionRef, outcome: SessionOutcome): void;
  onStateChange?(state: CaptureState, session: CaptureSessionRef | null): void;
}

interface CoordinatorConfig {
  hooks: CaptureCoordinatorHooks;
  observer?: CaptureCoordinatorObserver;
  generateId?: () => string;
}

let hooks: CaptureCoordinatorHooks | null = null;
let observer: CaptureCoordinatorObserver | undefined;
let idCounter = 0;
let generateId: () => string = () => {
  idCounter += 1;
  return `session-${idCounter}`;
};

let state: CaptureState = 'idle';
let active: CaptureSessionRef | null = null;
let generationCounter = 0;
let preparePromise: Promise<void> | null = null;
let cancelPromise: Promise<void> | null = null;
let startPending = false;
let delayedTimer: ReturnType<typeof setTimeout> | null = null;

function setState(next: CaptureState): void {
  state = next;
  observer?.onStateChange?.(next, active);
}

function endSession(session: CaptureSessionRef, outcome: SessionOutcome): void {
  if (active !== session) return;
  active = null;
  setState('idle');
  observer?.onSessionEnd?.(session, outcome);
}

function requireHooks(): CaptureCoordinatorHooks {
  if (!hooks) {
    throw new Error('Capture coordinator has not been configured');
  }
  return hooks;
}

function clearDelayedTimer(): void {
  if (delayedTimer) {
    clearTimeout(delayedTimer);
    delayedTimer = null;
  }
}

function beginSession(source: CaptureSource): CaptureSessionRef {
  generationCounter += 1;
  const session: CaptureSessionRef = {
    id: generateId(),
    generation: generationCounter,
    source,
  };
  active = session;
  observer?.onSessionStart?.(session);
  return session;
}

export function configureCaptureCoordinator(config: CoordinatorConfig): void {
  hooks = config.hooks;
  observer = config.observer;
  if (config.generateId) generateId = config.generateId;
}

export function getCaptureState(): CaptureState {
  return state;
}

export function getActiveSession(): CaptureSessionRef | null {
  return active;
}

/**
 * True while the given session is the active one and has not begun
 * cancellation. Async hook work must abort when this turns false.
 */
export function isSessionCurrent(session: CaptureSessionRef): boolean {
  return active?.generation === session.generation && state !== 'canceling';
}

export function hasPendingDelayedCapture(): boolean {
  return delayedTimer !== null;
}

export async function cancelCapture(
  reason: CancelReason,
  sessionId?: string,
): Promise<boolean> {
  clearDelayedTimer();
  if (sessionId !== undefined && active?.id !== sessionId) return false;
  if (state === 'idle') return true;
  if (state === 'canceling') {
    if (cancelPromise) await cancelPromise;
    return true;
  }
  if (state === 'committing') return false;
  if (!active) return false;

  const session = active;
  const pendingPrepare = preparePromise;
  setState('canceling');
  cancelPromise = (async () => {
    if (pendingPrepare) await pendingPrepare.catch(() => {});
    await requireHooks().cleanup(session, reason);
  })();
  try {
    await cancelPromise;
  } finally {
    cancelPromise = null;
    endSession(session, 'canceled');
  }
  return true;
}

export async function startCapture(source: CaptureSource): Promise<boolean> {
  requireHooks();
  clearDelayedTimer();
  if (startPending) return false;
  if (
    state === 'preparing' ||
    state === 'committing' ||
    state === 'canceling'
  ) {
    return false;
  }
  startPending = true;
  try {
    if (state === 'selecting') {
      await cancelCapture('replaced');
    }
    if (state !== 'idle') return false;

    const session = beginSession(source);
    setState('preparing');
    preparePromise = requireHooks().prepare(session);
    try {
      await preparePromise;
    } catch {
      if (getCaptureState() === 'canceling') return false;
      setState('canceling');
      await requireHooks()
        .cleanup(session, 'prepare-failed')
        .catch(() => {});
      endSession(session, 'error');
      return false;
    } finally {
      preparePromise = null;
    }
    if (!isSessionCurrent(session)) return false;
    setState('selecting');
    return true;
  } finally {
    startPending = false;
  }
}

export function scheduleCapture(delayMs: number, source: CaptureSource): void {
  requireHooks();
  clearDelayedTimer();
  delayedTimer = setTimeout(() => {
    delayedTimer = null;
    startCapture(source).catch(() => {});
  }, delayMs);
}

export async function confirmCapture(
  payload: CaptureCommitPayload,
  sessionId?: string,
): Promise<boolean> {
  if (state !== 'selecting' || !active) return false;
  if (sessionId !== undefined && sessionId !== active.id) return false;

  const session = active;
  setState('committing');
  try {
    await requireHooks().commit(session, payload);
    endSession(session, 'completed');
    return true;
  } catch {
    endSession(session, 'error');
    return false;
  }
}

export async function confirmSelection(
  selection: CaptureRect & { sessionId?: string },
): Promise<boolean> {
  return confirmCapture(
    {
      kind: 'selection',
      rect: {
        x: selection.x,
        y: selection.y,
        width: selection.width,
        height: selection.height,
      },
    },
    selection.sessionId,
  );
}

export async function startRecapture(
  selection: CaptureRect,
  source: CaptureSource = 'recapture',
): Promise<boolean> {
  requireHooks();
  clearDelayedTimer();
  if (startPending) return false;
  if (
    state === 'preparing' ||
    state === 'committing' ||
    state === 'canceling'
  ) {
    return false;
  }
  startPending = true;
  try {
    if (state === 'selecting') {
      await cancelCapture('replaced');
    }
    if (state !== 'idle') return false;

    const session = beginSession(source);
    setState('committing');
    try {
      await requireHooks().commit(session, {
        kind: 'selection',
        rect: selection,
      });
      endSession(session, 'completed');
      return true;
    } catch {
      endSession(session, 'error');
      return false;
    }
  } finally {
    startPending = false;
  }
}

/** Test-only: reset all coordinator state, timers, and configuration. */
export function resetCaptureCoordinatorForTests(): void {
  clearDelayedTimer();
  hooks = null;
  observer = undefined;
  idCounter = 0;
  generateId = () => {
    idCounter += 1;
    return `session-${idCounter}`;
  };
  state = 'idle';
  active = null;
  generationCounter = 0;
  preparePromise = null;
  cancelPromise = null;
  startPending = false;
}

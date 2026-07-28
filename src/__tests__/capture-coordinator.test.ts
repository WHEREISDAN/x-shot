/**
 * @jest-environment node
 */
import {
  cancelCapture,
  configureCaptureCoordinator,
  confirmCapture,
  confirmSelection,
  getActiveSession,
  getCaptureState,
  hasPendingDelayedCapture,
  isSessionCurrent,
  resetCaptureCoordinatorForTests,
  scheduleCapture,
  startCapture,
  startRecapture,
  type CaptureCoordinatorHooks,
  type CaptureSessionRef,
} from '../main/capture-coordinator';

const SELECTION = { x: 10, y: 20, width: 300, height: 200 };

interface Deferred {
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: Error) => void;
}

function deferred(): Deferred {
  const handle = {} as Deferred;
  handle.promise = new Promise<void>((resolve, reject) => {
    handle.resolve = resolve;
    handle.reject = reject;
  });
  return handle;
}

function makeHooks(
  overrides?: Partial<CaptureCoordinatorHooks>,
): jest.Mocked<CaptureCoordinatorHooks> {
  return {
    prepare: jest.fn().mockResolvedValue(undefined),
    commit: jest.fn().mockResolvedValue(undefined),
    cleanup: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as jest.Mocked<CaptureCoordinatorHooks>;
}

afterEach(() => {
  resetCaptureCoordinatorForTests();
  jest.useRealTimers();
});

describe('capture coordinator state machine', () => {
  it('walks idle -> preparing -> selecting -> committing -> idle', async () => {
    const states: string[] = [];
    const hooks = makeHooks();
    configureCaptureCoordinator({
      hooks,
      observer: { onStateChange: (s) => states.push(s) },
    });

    expect(getCaptureState()).toBe('idle');
    await startCapture('hotkey');
    expect(getCaptureState()).toBe('selecting');
    await confirmSelection(SELECTION);
    expect(getCaptureState()).toBe('idle');
    expect(states).toEqual(['preparing', 'selecting', 'committing', 'idle']);
    expect(hooks.commit).toHaveBeenCalledTimes(1);
    expect(hooks.commit).toHaveBeenCalledWith(expect.anything(), {
      kind: 'selection',
      rect: SELECTION,
    });
  });

  it('reports session start and completed outcome', async () => {
    const hooks = makeHooks();
    const onSessionStart = jest.fn();
    const onSessionEnd = jest.fn();
    configureCaptureCoordinator({
      hooks,
      observer: { onSessionStart, onSessionEnd },
    });

    await startCapture('tray');
    await confirmSelection(SELECTION);
    expect(onSessionStart).toHaveBeenCalledTimes(1);
    expect(onSessionStart.mock.calls[0][0].source).toBe('tray');
    expect(onSessionEnd).toHaveBeenCalledWith(expect.anything(), 'completed');
  });

  it('rejects confirm while idle or preparing', async () => {
    const prepareGate = deferred();
    const hooks = makeHooks({
      prepare: jest.fn().mockReturnValue(prepareGate.promise),
    });
    configureCaptureCoordinator({ hooks });

    expect(await confirmSelection(SELECTION)).toBe(false);
    const startPromise = startCapture('hotkey');
    expect(getCaptureState()).toBe('preparing');
    expect(await confirmSelection(SELECTION)).toBe(false);
    prepareGate.resolve();
    await startPromise;
    expect(hooks.commit).not.toHaveBeenCalled();
  });

  it('delivers exactly one screenshot for two confirmations', async () => {
    const commitGate = deferred();
    const hooks = makeHooks({
      commit: jest.fn().mockReturnValue(commitGate.promise),
    });
    configureCaptureCoordinator({ hooks });

    await startCapture('hotkey');
    const first = confirmSelection(SELECTION);
    const second = confirmSelection(SELECTION);
    commitGate.resolve();
    expect(await second).toBe(false);
    expect(await first).toBe(true);
    expect(hooks.commit).toHaveBeenCalledTimes(1);
  });

  it('rejects commit and cancel with a stale or unknown sessionId', async () => {
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    await startCapture('hotkey');
    const session = getActiveSession() as CaptureSessionRef;
    expect(
      await confirmSelection({ ...SELECTION, sessionId: 'bogus-id' }),
    ).toBe(false);
    expect(await cancelCapture('escape', 'bogus-id')).toBe(false);
    expect(getCaptureState()).toBe('selecting');

    expect(
      await confirmSelection({ ...SELECTION, sessionId: session.id }),
    ).toBe(true);
    expect(hooks.commit).toHaveBeenCalledTimes(1);
  });

  it('ignores repeated triggers while a transition is in progress', async () => {
    const prepareGate = deferred();
    const hooks = makeHooks({
      prepare: jest.fn().mockReturnValue(prepareGate.promise),
    });
    configureCaptureCoordinator({ hooks });

    const first = startCapture('hotkey');
    const repeats = await Promise.all(
      Array.from({ length: 9 }, () => startCapture('hotkey')),
    );
    expect(repeats.every((started) => started === false)).toBe(true);
    prepareGate.resolve();
    expect(await first).toBe(true);
    expect(hooks.prepare).toHaveBeenCalledTimes(1);
    expect(getCaptureState()).toBe('selecting');
  });

  it('replaces a selecting session when a new trigger arrives', async () => {
    const hooks = makeHooks();
    const outcomes: string[] = [];
    configureCaptureCoordinator({
      hooks,
      observer: { onSessionEnd: (_s, outcome) => outcomes.push(outcome) },
    });

    await startCapture('hotkey');
    const firstSession = getActiveSession() as CaptureSessionRef;
    await startCapture('hotkey');
    const secondSession = getActiveSession() as CaptureSessionRef;

    expect(hooks.cleanup).toHaveBeenCalledWith(firstSession, 'replaced');
    expect(secondSession.id).not.toBe(firstSession.id);
    expect(secondSession.generation).toBeGreaterThan(firstSession.generation);
    expect(isSessionCurrent(firstSession)).toBe(false);
    expect(isSessionCurrent(secondSession)).toBe(true);
    expect(outcomes).toEqual(['canceled']);
    expect(getCaptureState()).toBe('selecting');
  });

  it('cancels during preparing and cleans up after prepare settles', async () => {
    const prepareGate = deferred();
    const order: string[] = [];
    const hooks = makeHooks({
      prepare: jest.fn().mockImplementation(() => {
        order.push('prepare-start');
        return prepareGate.promise;
      }),
      cleanup: jest.fn().mockImplementation(async () => {
        order.push('cleanup');
      }),
    });
    configureCaptureCoordinator({ hooks });

    const startPromise = startCapture('hotkey');
    const session = getActiveSession() as CaptureSessionRef;
    const cancelPromise = cancelCapture('escape');
    expect(getCaptureState()).toBe('canceling');
    expect(isSessionCurrent(session)).toBe(false);
    prepareGate.resolve();
    await Promise.all([startPromise, cancelPromise]);

    expect(order).toEqual(['prepare-start', 'cleanup']);
    expect(getCaptureState()).toBe('idle');
    expect(getActiveSession()).toBeNull();
  });

  it('is idempotent for concurrent cancels', async () => {
    const cleanupGate = deferred();
    const hooks = makeHooks({
      cleanup: jest.fn().mockReturnValue(cleanupGate.promise),
    });
    configureCaptureCoordinator({ hooks });

    await startCapture('hotkey');
    const first = cancelCapture('escape');
    const second = cancelCapture('escape');
    cleanupGate.resolve();
    expect(await first).toBe(true);
    expect(await second).toBe(true);
    expect(hooks.cleanup).toHaveBeenCalledTimes(1);
    expect(getCaptureState()).toBe('idle');
  });

  it('cancel while idle is a safe no-op', async () => {
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });
    expect(await cancelCapture('escape')).toBe(true);
    expect(hooks.cleanup).not.toHaveBeenCalled();
  });

  it('cleans up and ends with error when prepare fails', async () => {
    const outcomes: string[] = [];
    const hooks = makeHooks({
      prepare: jest.fn().mockRejectedValue(new Error('boom')),
    });
    configureCaptureCoordinator({
      hooks,
      observer: { onSessionEnd: (_s, outcome) => outcomes.push(outcome) },
    });

    expect(await startCapture('hotkey')).toBe(false);
    expect(hooks.cleanup).toHaveBeenCalledWith(
      expect.anything(),
      'prepare-failed',
    );
    expect(outcomes).toEqual(['error']);
    expect(getCaptureState()).toBe('idle');
  });

  it('reports an error outcome when commit fails', async () => {
    const outcomes: string[] = [];
    const hooks = makeHooks({
      commit: jest.fn().mockRejectedValue(new Error('crop failed')),
    });
    configureCaptureCoordinator({
      hooks,
      observer: { onSessionEnd: (_s, outcome) => outcomes.push(outcome) },
    });

    await startCapture('hotkey');
    expect(await confirmSelection(SELECTION)).toBe(false);
    expect(outcomes).toEqual(['error']);
    expect(getCaptureState()).toBe('idle');
  });
});

describe('source-picker commits', () => {
  it('commits a window source and returns to idle', async () => {
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    await startCapture('hotkey');
    expect(
      await confirmCapture({ kind: 'window', sourceId: 'window:42' }),
    ).toBe(true);
    expect(hooks.commit).toHaveBeenCalledWith(expect.anything(), {
      kind: 'window',
      sourceId: 'window:42',
    });
    expect(getCaptureState()).toBe('idle');
  });

  it('commits a screen source and returns to idle', async () => {
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    await startCapture('hotkey');
    expect(await confirmCapture({ kind: 'screen', displayId: 7 })).toBe(true);
    expect(hooks.commit).toHaveBeenCalledWith(expect.anything(), {
      kind: 'screen',
      displayId: 7,
    });
    expect(getCaptureState()).toBe('idle');
  });

  it('ignores a source commit with no active session', async () => {
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    expect(
      await confirmCapture({ kind: 'window', sourceId: 'window:42' }),
    ).toBe(false);
    expect(hooks.commit).not.toHaveBeenCalled();
  });
});

describe('delayed capture', () => {
  it('starts a session when the timer fires', async () => {
    jest.useFakeTimers();
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    scheduleCapture(3000, 'delayed');
    expect(hasPendingDelayedCapture()).toBe(true);
    expect(hooks.prepare).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(3000);
    expect(hooks.prepare).toHaveBeenCalledTimes(1);
    expect(getCaptureState()).toBe('selecting');
  });

  it('can be canceled before the timer fires', async () => {
    jest.useFakeTimers();
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    scheduleCapture(5000, 'delayed');
    expect(await cancelCapture('escape')).toBe(true);
    expect(hasPendingDelayedCapture()).toBe(false);
    await jest.advanceTimersByTimeAsync(10000);
    expect(hooks.prepare).not.toHaveBeenCalled();
    expect(getCaptureState()).toBe('idle');
  });
});

describe('recapture', () => {
  it('commits directly without preparing overlays', async () => {
    const states: string[] = [];
    const hooks = makeHooks();
    configureCaptureCoordinator({
      hooks,
      observer: { onStateChange: (s) => states.push(s) },
    });

    expect(await startRecapture(SELECTION)).toBe(true);
    expect(hooks.prepare).not.toHaveBeenCalled();
    expect(hooks.commit).toHaveBeenCalledWith(expect.anything(), {
      kind: 'selection',
      rect: SELECTION,
    });
    expect(states).toEqual(['committing', 'idle']);
  });

  it('replaces an active selection before recapturing', async () => {
    const hooks = makeHooks();
    configureCaptureCoordinator({ hooks });

    await startCapture('hotkey');
    expect(await startRecapture(SELECTION)).toBe(true);
    expect(hooks.cleanup).toHaveBeenCalledWith(expect.anything(), 'replaced');
    expect(hooks.commit).toHaveBeenCalledTimes(1);
    expect(getCaptureState()).toBe('idle');
  });

  it('is ignored while a commit is already in progress', async () => {
    const commitGate = deferred();
    const hooks = makeHooks({
      commit: jest.fn().mockReturnValue(commitGate.promise),
    });
    configureCaptureCoordinator({ hooks });

    const first = startRecapture(SELECTION);
    expect(await startRecapture(SELECTION)).toBe(false);
    commitGate.resolve();
    expect(await first).toBe(true);
    expect(hooks.commit).toHaveBeenCalledTimes(1);
  });
});

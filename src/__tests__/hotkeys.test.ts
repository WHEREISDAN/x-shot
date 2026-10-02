/**
 * @jest-environment node
 */
import { updateRegisteredHotkeys } from '../main/hotkeys';

const mockRegistered = new Map<string, () => void>();
// Shortcuts another app holds; registering them fails.
const mockTakenElsewhere = new Set<string>();

function throwIfUnparseable(accelerator: string): void {
  if (accelerator.includes('NotAKey')) {
    throw new TypeError(
      `Error processing argument at index 0, conversion failure from ${accelerator}`,
    );
  }
}

jest.mock('electron', () => ({
  app: { isReady: () => true },
  globalShortcut: {
    register: (accelerator: string, callback: () => void) => {
      throwIfUnparseable(accelerator);
      if (mockRegistered.has(accelerator)) return false;
      if (mockTakenElsewhere.has(accelerator)) return false;
      mockRegistered.set(accelerator, callback);
      return true;
    },
    isRegistered: (accelerator: string) => {
      throwIfUnparseable(accelerator);
      return mockRegistered.has(accelerator);
    },
    unregister: (accelerator: string) => {
      mockRegistered.delete(accelerator);
    },
    unregisterAll: () => mockRegistered.clear(),
  },
}));

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

const MAIN = 'CommandOrControl+Shift+1';
const OTHER = 'CommandOrControl+Shift+2';
const DELAY = 'CommandOrControl+Shift+3';
const INVALID = 'Ctrl+Shift+NotAKey';

function makeTriggers() {
  return {
    triggerMain: jest.fn(),
    triggerDelay: jest.fn(),
    triggerRecapture: jest.fn(),
  };
}

beforeEach(() => {
  updateRegisteredHotkeys(
    { main: null, delay3: null, delay5: null, recapture: null },
    makeTriggers(),
  );
  mockRegistered.clear();
  mockTakenElsewhere.clear();
});

describe('updateRegisteredHotkeys', () => {
  it('does not throw when an accelerator cannot be parsed', () => {
    expect(() =>
      updateRegisteredHotkeys({ main: INVALID }, makeTriggers()),
    ).not.toThrow();
    expect(mockRegistered.size).toBe(0);
  });

  it('keeps the first binding when two slots share an accelerator', () => {
    const triggers = makeTriggers();
    updateRegisteredHotkeys(
      { main: MAIN, delay3: { accelerator: MAIN, delayMs: 3000 } },
      triggers,
    );
    expect([...mockRegistered.keys()]).toEqual([MAIN]);
    mockRegistered.get(MAIN)?.();
    expect(triggers.triggerMain).toHaveBeenCalledTimes(1);
    expect(triggers.triggerDelay).not.toHaveBeenCalled();
  });

  it('rebinds a changed slot and releases a cleared one', () => {
    const triggers = makeTriggers();
    updateRegisteredHotkeys(
      { main: MAIN, delay3: { accelerator: DELAY, delayMs: 3000 } },
      triggers,
    );
    updateRegisteredHotkeys(
      { main: OTHER, delay3: { accelerator: null, delayMs: 3000 } },
      triggers,
    );
    expect([...mockRegistered.keys()]).toEqual([OTHER]);
  });

  it('keeps the previous shortcut when the new one is invalid', () => {
    const triggers = makeTriggers();
    updateRegisteredHotkeys({ main: MAIN, recapture: DELAY }, triggers);
    expect(updateRegisteredHotkeys({ main: INVALID }, triggers)).toEqual([
      { label: 'main', accelerator: INVALID },
    ]);
    expect([...mockRegistered.keys()].sort()).toEqual([DELAY, MAIN].sort());
    updateRegisteredHotkeys({ main: OTHER }, triggers);
    expect([...mockRegistered.keys()].sort()).toEqual([DELAY, OTHER].sort());
  });

  it('reports a shortcut another app holds and keeps the previous one', () => {
    const triggers = makeTriggers();
    updateRegisteredHotkeys({ main: MAIN }, triggers);
    mockTakenElsewhere.add(OTHER);
    expect(updateRegisteredHotkeys({ main: OTHER }, triggers)).toEqual([
      { label: 'main', accelerator: OTHER },
    ]);
    expect([...mockRegistered.keys()]).toEqual([MAIN]);
    mockRegistered.get(MAIN)?.();
    expect(triggers.triggerMain).toHaveBeenCalledTimes(1);
  });

  it('reports no failures when every shortcut registers', () => {
    expect(
      updateRegisteredHotkeys(
        { main: MAIN, delay3: { accelerator: DELAY, delayMs: 3000 } },
        makeTriggers(),
      ),
    ).toEqual([]);
  });

  it('passes the configured delay to delayed triggers', () => {
    const triggers = makeTriggers();
    updateRegisteredHotkeys(
      { delay5: { accelerator: DELAY, delayMs: 5000 } },
      triggers,
    );
    mockRegistered.get(DELAY)?.();
    expect(triggers.triggerDelay).toHaveBeenCalledWith(5000);
  });
});

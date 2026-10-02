import { act, fireEvent, render, screen } from '@testing-library/react';
import PreferencesWindow from '../renderer/components/preferences/PreferencesWindow';
import { installPreferencesFlushListener } from '../renderer/hooks/pending-preferences';
import type { AppPreferences } from '../shared/ipc-types';
import { deepMerge } from '../shared/deep-merge';
import PREFERENCES from './fixtures/preferences';

let stored: AppPreferences;
const events: string[] = [];
const listeners = new Map<string, (payload: unknown) => void>();

const invoke = jest.fn(async (channel: string, payload?: unknown) => {
  if (channel === 'get-preferences') return stored;
  if (channel === 'set-preferences') {
    const { preferences } = payload as { preferences: unknown };
    stored = deepMerge(stored, preferences);
    events.push(`saved ${JSON.stringify(preferences)}`);
    return { ok: true, preferences: stored };
  }
  return undefined;
});
const sendMessage = jest.fn((channel: string, payload: unknown) => {
  events.push(`${channel} ${JSON.stringify(payload)}`);
});

/** Main asking this window to save, as 'flush-preferences' arrives. */
const requestFlush = (requestId: string) =>
  act(async () => {
    listeners.get('flush-preferences')?.({ requestId });
    for (let i = 0; i < 10; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });

let uninstall: () => void = () => {};

beforeEach(() => {
  jest.useFakeTimers();
  stored = PREFERENCES;
  events.length = 0;
  invoke.mockClear();
  sendMessage.mockClear();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: {
      invoke,
      sendMessage,
      log: jest.fn(),
      on: jest.fn((channel: string, listener: (payload: unknown) => void) => {
        listeners.set(channel, listener);
        return () => listeners.delete(channel);
      }),
    },
  };
  uninstall = installPreferencesFlushListener();
});

afterEach(() => {
  uninstall();
  jest.useRealTimers();
  delete (window as unknown as { electron?: unknown }).electron;
});

describe('flush-preferences', () => {
  it('answers at once when nothing is pending', async () => {
    await requestFlush('r1');
    expect(events).toEqual(['preferences-flushed {"requestId":"r1"}']);
  });

  it('saves a change still waiting for its pause, then answers', async () => {
    render(<PreferencesWindow />);
    await act(async () => {
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole('tab', { name: /Export/ }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Filename Pattern' }),
      { target: { value: 'typed-before-quit' } },
    );
    expect(events).toEqual([]);

    await requestFlush('r2');

    expect(events).toEqual([
      'saved {"export":{"filenamePattern":"typed-before-quit"}}',
      'preferences-flushed {"requestId":"r2"}',
    ]);
    // The pause that was running saves nothing more.
    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(
      invoke.mock.calls.filter(([c]) => c === 'set-preferences'),
    ).toHaveLength(1);
  });
});

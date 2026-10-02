import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import PreferencesWindow from '../renderer/components/preferences/PreferencesWindow';
import type {
  AppPreferences,
  SetPreferencesResponse,
} from '../shared/ipc-types';
import { deepMerge } from '../shared/deep-merge';
import { PREFERENCES_DEBOUNCE_MS } from '../renderer/hooks/use-preferences-writer';
import PREFERENCES from './fixtures/preferences';

let stored: AppPreferences;
let nextSetResult: SetPreferencesResponse | null;
const invoke = jest.fn(async (channel: string, payload?: unknown) => {
  if (channel === 'get-preferences') return stored;
  if (channel === 'set-preferences') {
    if (nextSetResult) return nextSetResult;
    stored = deepMerge(
      stored,
      (payload as { preferences: unknown }).preferences,
    );
    return { ok: true, preferences: stored };
  }
  return undefined;
});

const setPreferenceCalls = () =>
  invoke.mock.calls
    .filter(([channel]) => channel === 'set-preferences')
    .map(([, payload]) => (payload as { preferences: unknown }).preferences);

/** Lets pending promises and React updates settle. */
const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

async function openTab(name: string) {
  render(<PreferencesWindow />);
  await settle();
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(name) }));
}

beforeEach(() => {
  jest.useFakeTimers();
  stored = PREFERENCES;
  nextSetResult = null;
  invoke.mockClear();
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { invoke, log: jest.fn(), on: jest.fn(() => () => {}) },
  };
});

afterEach(() => {
  jest.useRealTimers();
  delete (window as unknown as { electron?: unknown }).electron;
});

describe('Preferences window', () => {
  it('keeps focus in a text field while it saves', async () => {
    await openTab('Export');
    const field = screen.getByLabelText('Filename Pattern');
    field.focus();

    ['X-Shot_a', 'X-Shot_ab', 'X-Shot_abc'].forEach((value) =>
      fireEvent.change(field, { target: { value } }),
    );
    expect(setPreferenceCalls()).toEqual([]);

    await act(async () => {
      jest.advanceTimersByTime(PREFERENCES_DEBOUNCE_MS);
    });
    await settle();

    expect(setPreferenceCalls()).toEqual([
      { export: { filenamePattern: 'X-Shot_abc' } },
    ]);
    // The same element, still focused: the window did not reload.
    expect(screen.getByLabelText('Filename Pattern')).toBe(field);
    expect(field).toHaveFocus();
    expect(field).toHaveValue('X-Shot_abc');
    expect(
      screen.queryByText('Loading preferences...'),
    ).not.toBeInTheDocument();
  });

  it('saves a slider drag once, after the drag pauses', async () => {
    await openTab('Editor');
    const slider = screen.getByLabelText(/stroke width/i);

    [4, 5, 6, 7, 8].forEach((value) =>
      fireEvent.change(slider, { target: { value: String(value) } }),
    );
    await act(async () => {
      jest.advanceTimersByTime(PREFERENCES_DEBOUNCE_MS - 1);
    });
    expect(setPreferenceCalls()).toEqual([]);

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    await settle();
    expect(setPreferenceCalls()).toEqual([
      { editor: { defaultStrokeWidth: 8 } },
    ]);
    expect(slider).toHaveValue('8');
  });

  it('saves at once when a debounced field loses focus', async () => {
    await openTab('Export');
    const field = screen.getByLabelText('Filename Pattern');
    fireEvent.change(field, { target: { value: 'shot' } });
    fireEvent.blur(field);
    await settle();
    expect(setPreferenceCalls()).toEqual([
      { export: { filenamePattern: 'shot' } },
    ]);
  });

  it('shows why a save failed and goes back to what main has', async () => {
    await openTab('General');
    nextSetResult = {
      ok: false,
      error: 'Your preferences could not be saved: disk full',
    };

    fireEvent.click(screen.getByLabelText(/auto-copy screenshots/i));
    await settle();

    expect(screen.getByRole('alert')).toHaveTextContent('disk full');
    expect(screen.getByLabelText(/auto-copy screenshots/i)).not.toBeChecked();
  });
});

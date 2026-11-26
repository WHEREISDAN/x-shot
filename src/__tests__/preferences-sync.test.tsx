import '@testing-library/jest-dom';
import { act, render, renderHook, screen } from '@testing-library/react';
import EmptyState from '../renderer/components/EmptyState';
import usePiiPreferences from '../renderer/hooks/pii/preferences';
import usePreferences from '../renderer/hooks/use-preferences';
import { usePresentationState } from '../renderer/hooks/use-presentation-state';
import { useEditorState } from '../renderer/hooks/use-editor-state';
import type { AppPreferences } from '../shared/ipc-types';
import { deepMerge } from '../shared/deep-merge';
import PREFERENCES from './fixtures/preferences';

type Listener = (payload: unknown) => void;

let stored: AppPreferences;
let listeners: Map<string, Set<Listener>>;
let invoke: jest.Mock;
let on: jest.Mock;

function emit(channel: string, payload: unknown) {
  act(() => {
    listeners.get(channel)?.forEach((fn) => fn(payload));
  });
}

const settle = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  stored = PREFERENCES;
  listeners = new Map();
  invoke = jest.fn(async (channel: string, payload?: unknown) => {
    if (channel === 'get-preferences') return stored;
    if (channel === 'set-preferences') {
      stored = deepMerge(
        stored,
        (payload as { preferences: unknown }).preferences,
      );
      return { ok: true, preferences: stored };
    }
    return undefined;
  });
  on = jest.fn((channel: string, listener: Listener) => {
    const set = listeners.get(channel) ?? new Set<Listener>();
    set.add(listener);
    listeners.set(channel, set);
    return () => {
      set.delete(listener);
    };
  });
  (window as unknown as { electron: unknown }).electron = {
    ipcRenderer: { invoke, on, log: jest.fn() },
  };
});

afterEach(() => {
  delete (window as unknown as { electron?: unknown }).electron;
});

describe('preferences-changed renderer propagation', () => {
  it('updates EmptyState hotkey on preferences-changed and unsubscribes on unmount', async () => {
    const { unmount } = render(<EmptyState />);
    await settle();
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(listeners.get('preferences-changed')?.size).toBe(1);

    emit(
      'preferences-changed',
      deepMerge(PREFERENCES, {
        capture: { hotkey: 'CommandOrControl+Shift+9' },
      }),
    );
    expect(screen.getByText('9')).toBeInTheDocument();

    unmount();
    expect(listeners.get('preferences-changed')?.size).toBe(0);
  });

  it('updates usePiiPreferences without writing back and unsubscribes on unmount', async () => {
    const { result, unmount } = renderHook(() => usePiiPreferences());
    await settle();
    expect(result.current.censorPII).toBe(false);
    expect(result.current.defaultStyle).toBe('black');

    const updated = deepMerge(PREFERENCES, {
      pii: {
        autoDetect: true,
        defaultStyle: 'blur',
        detectors: { ssn: true },
      },
    });
    emit('preferences-changed', updated);

    expect(result.current.censorPII).toBe(true);
    expect(result.current.defaultStyle).toBe('blur');
    expect(result.current.detectors?.ssn).toBe(true);
    expect(
      invoke.mock.calls.filter(([channel]) => channel === 'set-preferences'),
    ).toHaveLength(0);

    unmount();
    expect(listeners.get('preferences-changed')?.size).toBe(0);
  });

  it('updates usePresentationState without write-back loops and preserves local exportScale unless defaultScale changed', async () => {
    const { result, unmount } = renderHook(() => usePresentationState());
    await settle();
    expect(result.current[0].padding).toBe(48);
    expect(result.current[0].exportScale).toBe(1);

    // Pick a per-capture export scale locally.
    act(() => result.current[1].setExportScale(3));
    expect(result.current[0].exportScale).toBe(3);

    // An external presentation update (with unchanged export.defaultScale) keeps local exportScale.
    emit(
      'preferences-changed',
      deepMerge(PREFERENCES, { presentation: { padding: 80 } }),
    );
    expect(result.current[0].padding).toBe(80);
    expect(result.current[0].exportScale).toBe(3);

    // Changing export.defaultScale in Preferences updates exportScale too.
    emit(
      'preferences-changed',
      deepMerge(PREFERENCES, {
        presentation: { padding: 80 },
        export: { defaultScale: 2 },
      }),
    );
    expect(result.current[0].exportScale).toBe(2);
    expect(
      invoke.mock.calls.filter(([channel]) => channel === 'set-preferences'),
    ).toHaveLength(0);

    unmount();
    expect(listeners.get('preferences-changed')?.size).toBe(0);
  });

  it('updates usePreferences on external broadcast without write-back loops and unsubscribes on unmount', async () => {
    const { result, unmount } = renderHook(() => usePreferences());
    await settle();
    expect(result.current.preferences?.export.autoSave).toBe(false);

    emit(
      'preferences-changed',
      deepMerge(PREFERENCES, { export: { autoSave: true } }),
    );
    expect(result.current.preferences?.export.autoSave).toBe(true);
    expect(
      invoke.mock.calls.filter(([channel]) => channel === 'set-preferences'),
    ).toHaveLength(0);

    unmount();
    expect(listeners.get('preferences-changed')?.size).toBe(0);
  });

  it('updates useEditorState only for editor preference fields that actually changed', async () => {
    const { result, unmount } = renderHook(() => useEditorState());
    await settle();
    expect(result.current.strokeColor).toBe('#ef4444');

    // User chooses a local brush color in this editor session.
    act(() => result.current.setStrokeColor('#3b82f6'));
    expect(result.current.strokeColor).toBe('#3b82f6');

    // An unrelated preference change (PII toggle) must NOT clobber the local brush color.
    emit(
      'preferences-changed',
      deepMerge(PREFERENCES, { pii: { autoDetect: true } }),
    );
    expect(result.current.strokeColor).toBe('#3b82f6');

    // Changing defaultStrokeColor in Preferences DOES update the editor.
    emit(
      'preferences-changed',
      deepMerge(PREFERENCES, { editor: { defaultStrokeColor: '#22c55e' } }),
    );
    expect(result.current.strokeColor).toBe('#22c55e');

    unmount();
    expect(listeners.get('preferences-changed')?.size).toBe(0);
  });
});

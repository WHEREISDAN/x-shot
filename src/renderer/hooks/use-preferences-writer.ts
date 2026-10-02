import { useCallback, useEffect, useMemo, useRef } from 'react';
import type {
  PreferencesUpdate,
  SetPreferencesResponse,
} from '../../shared/ipc-types';
import { deepMerge } from '../../shared/deep-merge';
import { registerPreferencesFlush } from './pending-preferences';

/** How long sliders and text fields wait for more changes before saving. */
export const PREFERENCES_DEBOUNCE_MS = 300;

export interface PreferencesWriter {
  /** Saves `updates` after a pause; later calls restart the pause. */
  schedule: (updates: PreferencesUpdate) => void;
  /** Saves everything scheduled now, together with `updates` if given. */
  flush: (
    updates?: PreferencesUpdate,
  ) => Promise<SetPreferencesResponse | null>;
}

async function sendUpdates(
  updates: PreferencesUpdate,
): Promise<SetPreferencesResponse> {
  const api = window?.electron?.ipcRenderer;
  if (!api) return { ok: false, error: 'Electron IPC not available' };
  try {
    return await api.invoke('set-preferences', { preferences: updates });
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Batches preference writes. Pending changes are saved on flush, when the
 * component unmounts, and when main asks before closing the window or
 * quitting, so none are lost.
 */
export default function usePreferencesWriter(
  onResult: (result: SetPreferencesResponse) => void,
): PreferencesWriter {
  const pendingRef = useRef<PreferencesUpdate | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const flush = useCallback(async (updates?: PreferencesUpdate) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    const batch = updates
      ? deepMerge(pendingRef.current ?? {}, updates)
      : pendingRef.current;
    pendingRef.current = null;
    if (!batch) return null;
    const result = await sendUpdates(batch);
    onResultRef.current(result);
    return result;
  }, []);

  const schedule = useCallback(
    (updates: PreferencesUpdate) => {
      pendingRef.current = deepMerge(pendingRef.current ?? {}, updates);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        flush().catch(() => {});
      }, PREFERENCES_DEBOUNCE_MS);
    },
    [flush],
  );

  useEffect(() => {
    const unregister = registerPreferencesFlush(flush);
    // Covers reloads, which main does not announce.
    const onUnload = () => {
      flush().catch(() => {});
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      unregister();
      window.removeEventListener('beforeunload', onUnload);
      onUnload();
    };
  }, [flush]);

  return useMemo(() => ({ schedule, flush }), [schedule, flush]);
}

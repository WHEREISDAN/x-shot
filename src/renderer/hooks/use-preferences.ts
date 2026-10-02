import { useCallback, useEffect, useState } from 'react';
import type {
  AppPreferences,
  PreferencesUpdate,
  SetPreferencesResponse,
} from '../../shared/ipc-types';
import { deepMerge } from '../../shared/deep-merge';
import { createRendererLogger } from '../utils/logger';
import usePreferencesWriter from './use-preferences-writer';

const logger = createRendererLogger('use-preferences');

export interface UpdateOptions {
  /** Wait for a pause before saving, for sliders and text fields. */
  debounce?: boolean;
}

export type UpdatePreferences = (
  updates: PreferencesUpdate,
  options?: UpdateOptions,
) => Promise<boolean>;

interface UsePreferencesResult {
  preferences: AppPreferences | null;
  /** True only until the first load finishes. */
  loading: boolean;
  error: string | null;
  updatePreferences: UpdatePreferences;
  /** Saves debounced changes now, e.g. when a field loses focus. */
  flushPreferences: () => void;
  resetPreferences: () => Promise<boolean>;
  dismissError: () => void;
}

const messageOf = (error: unknown, fallback: string) =>
  error instanceof Error ? error.message : fallback;

/**
 * The preferences shown in a window. Changes apply locally at once and are
 * saved in the background, so a save never reloads the window or moves
 * focus. A failed save is reported and the window reloads what main has.
 */
export default function usePreferences(): UsePreferencesResult {
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    const api = window?.electron?.ipcRenderer;
    if (!api) throw new Error('Electron IPC not available');
    setPreferences(await api.invoke('get-preferences', {}));
  }, []);

  const handleResult = useCallback(
    (result: SetPreferencesResponse) => {
      if (result.ok) return;
      setError(result.error);
      logger.error('Failed to save preferences', { error: result.error });
      reload().catch((err) =>
        logger.error('Failed to reload preferences', err),
      );
    },
    [reload],
  );
  const writer = usePreferencesWriter(handleResult);

  useEffect(() => {
    const loadOnce = async () => {
      try {
        await reload();
      } catch (err) {
        setError(messageOf(err, 'Failed to load preferences'));
        logger.error('Failed to load preferences', err);
      } finally {
        setLoading(false);
      }
    };
    loadOnce().catch(() => {});
  }, [reload]);

  const updatePreferences = useCallback<UpdatePreferences>(
    async (updates, options) => {
      setPreferences((current) => current && deepMerge(current, updates));
      if (options?.debounce) {
        writer.schedule(updates);
        return true;
      }
      const result = await writer.flush(updates);
      return result?.ok ?? false;
    },
    [writer],
  );

  const flushPreferences = useCallback(() => {
    writer.flush().catch(() => {});
  }, [writer]);

  const resetPreferences = useCallback(async (): Promise<boolean> => {
    try {
      const api = window?.electron?.ipcRenderer;
      if (!api) throw new Error('Electron IPC not available');
      await writer.flush();
      setPreferences(await api.invoke('reset-preferences', undefined));
      return true;
    } catch (err) {
      setError(messageOf(err, 'Failed to reset preferences'));
      logger.error('Failed to reset preferences', err);
      return false;
    }
  }, [writer]);

  const dismissError = useCallback(() => setError(null), []);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    flushPreferences,
    resetPreferences,
    dismissError,
  };
}

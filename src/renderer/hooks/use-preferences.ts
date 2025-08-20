import { useCallback, useEffect, useState } from 'react';
import type { AppPreferences } from '../../shared/ipc-types';
import { createRendererLogger } from '../utils/logger';

const logger = createRendererLogger('use-preferences');

interface UsePreferencesResult {
  preferences: AppPreferences | null;
  loading: boolean;
  error: string | null;
  updatePreferences: (updates: Partial<AppPreferences>) => Promise<boolean>;
  resetPreferences: () => Promise<boolean>;
  refreshPreferences: () => Promise<void>;
}

export default function usePreferences(): UsePreferencesResult {
  const [preferences, setPreferences] = useState<AppPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPreferences = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const api = window?.electron?.ipcRenderer;
      if (!api) {
        throw new Error('Electron IPC not available');
      }

      const prefs = await api.invoke('get-preferences', {});
      setPreferences(prefs);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load preferences';
      setError(message);
      logger.error('Failed to load preferences', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const updatePreferences = useCallback(
    async (updates: Partial<AppPreferences>): Promise<boolean> => {
      try {
        const api = window?.electron?.ipcRenderer;
        if (!api) {
          throw new Error('Electron IPC not available');
        }

        const success = await api.invoke('set-preferences', {
          preferences: updates,
        });

        if (success) {
          // Refresh preferences to get the latest state
          await refreshPreferences();
        }

        return success;
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Failed to update preferences';
        setError(message);
        logger.error('Failed to update preferences', err);
        return false;
      }
    },
    [refreshPreferences],
  );

  const resetPreferences = useCallback(async (): Promise<boolean> => {
    try {
      const api = window?.electron?.ipcRenderer;
      if (!api) {
        throw new Error('Electron IPC not available');
      }

      const defaultPrefs = await api.invoke('reset-preferences', undefined);
      setPreferences(defaultPrefs);
      return true;
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reset preferences';
      setError(message);
      logger.error('Failed to reset preferences', err);
      return false;
    }
  }, []);

  // Load preferences on mount
  useEffect(() => {
    refreshPreferences();
  }, [refreshPreferences]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    resetPreferences,
    refreshPreferences,
  };
}

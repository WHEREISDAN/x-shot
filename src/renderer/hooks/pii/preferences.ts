import { useCallback, useEffect, useState } from 'react';
import type { PiiDetectors, PiiPreferencesState } from './types';
import { createRendererLogger } from '../../utils/logger';

const logger = createRendererLogger('pii/preferences');

function usePiiPreferences(): PiiPreferencesState {
  const [censorPII, setCensorPIIState] = useState<boolean>(false);
  const [defaultStyle, setDefaultStyle] = useState<'blur' | 'black'>('black');
  const [detectors, setDetectors] = useState<PiiDetectors | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadPiiPreferences = async () => {
      try {
        const api = window?.electron?.ipcRenderer;
        if (!api) return;
        const preferences = await api.invoke('get-preferences', {});
        if (preferences?.pii) {
          setCensorPIIState(preferences.pii.autoDetect);
          setDefaultStyle(preferences.pii.defaultStyle);
          setDetectors(preferences.pii.detectors ?? null);
        }
      } catch (error) {
        logger.warn('Failed to load PII preferences', error);
      } finally {
        setLoaded(true);
      }
    };
    loadPiiPreferences();
  }, []);

  const setCensorPII = useCallback(async (enabled: boolean) => {
    setCensorPIIState(enabled);
    try {
      const api = window?.electron?.ipcRenderer;
      if (!api) return;
      const result = await api.invoke('set-preferences', {
        preferences: { pii: { autoDetect: enabled } },
      });
      if (!result.ok) logger.warn('Failed to save Censor PII', result);
    } catch (error) {
      logger.warn('Failed to save PII preferences', error);
    }
  }, []);

  return { censorPII, setCensorPII, defaultStyle, detectors, loaded };
}

export default usePiiPreferences;

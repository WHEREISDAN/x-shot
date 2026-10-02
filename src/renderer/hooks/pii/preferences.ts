import { useCallback, useEffect, useState } from 'react';
import type { PiiDetectors } from './types';
import { createRendererLogger } from '../../utils/logger';

const logger = createRendererLogger('pii/preferences');

function usePiiPreferences() {
  const [censorPII, setCensorPIIState] = useState<boolean>(false);
  const [defaultStyle, setDefaultStyle] = useState<'blur' | 'black'>('black');
  const [detectors, setDetectors] = useState<PiiDetectors | null>(null);
  // Censor PII reads as off until loaded; callers must not act on it before.
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
      const currentPrefs = await api.invoke('get-preferences', {});
      await api.invoke('set-preferences', {
        preferences: {
          pii: {
            autoDetect: enabled,
            defaultStyle: currentPrefs?.pii?.defaultStyle || 'black',
            detectors: currentPrefs?.pii?.detectors,
          },
        },
      });
    } catch (error) {
      logger.warn('Failed to save PII preferences', error);
    }
  }, []);

  return { censorPII, setCensorPII, defaultStyle, detectors, loaded } as const;
}

export default usePiiPreferences;

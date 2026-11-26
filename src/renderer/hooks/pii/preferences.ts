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
    const api = window?.electron?.ipcRenderer;
    let active = true;

    const applyPii = (
      pii:
        | {
            autoDetect: boolean;
            defaultStyle: 'blur' | 'black';
            detectors?: PiiDetectors | null;
          }
        | undefined,
    ) => {
      if (!active || !pii) return;
      setCensorPIIState(pii.autoDetect);
      setDefaultStyle(pii.defaultStyle);
      setDetectors(pii.detectors ?? null);
    };

    const loadPiiPreferences = async () => {
      try {
        if (!api) return;
        const preferences = await api.invoke('get-preferences', {});
        applyPii(preferences?.pii);
      } catch (error) {
        logger.warn('Failed to load PII preferences', error);
      } finally {
        if (active) setLoaded(true);
      }
    };
    loadPiiPreferences();

    const unsubscribe =
      typeof api?.on === 'function'
        ? api.on('preferences-changed', (next) => applyPii(next?.pii))
        : undefined;

    return () => {
      active = false;
      unsubscribe?.();
    };
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

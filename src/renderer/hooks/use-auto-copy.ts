import { useEffect, useRef, useState } from 'react';
import type { PiiLayerStatus } from './pii/types';
import { createRendererLogger } from '../utils/logger';
import fetchImageBytes from '../utils/image-url';

const logger = createRendererLogger('auto-copy');

export interface UseAutoCopyParams {
  /** The capture as loaded by the editor. */
  rawImageUrl: string;
  censorPII: boolean;
  piiPreferencesLoaded: boolean;
  piiStatus: PiiLayerStatus;
  exportRedacted: () => Promise<Uint8Array>;
  copy: (png: Uint8Array) => Promise<boolean>;
}

/**
 * Copies a new capture once when the auto-copy preference is on. With
 * Censor PII on it waits for the PII layer and copies the redacted export;
 * the raw capture is never copied in that case.
 */
export function useAutoCopy({
  rawImageUrl,
  censorPII,
  piiPreferencesLoaded,
  piiStatus,
  exportRedacted,
  copy,
}: UseAutoCopyParams): void {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const copiedRef = useRef(false);

  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) {
      setEnabled(false);
      return () => {};
    }
    let active = true;
    api
      .invoke('get-preferences', {})
      .then((preferences) => {
        const autoCopy = Boolean(preferences?.capture?.autoCopyToClipboard);
        if (active) setEnabled(autoCopy);
        return autoCopy;
      })
      .catch((error) => {
        logger.warn('Failed to read the auto-copy preference', error);
        if (active) setEnabled(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (copiedRef.current || !enabled || !piiPreferencesLoaded) return;

    if (!censorPII) {
      copiedRef.current = true;
      fetchImageBytes(rawImageUrl)
        .then(copy)
        .catch((error) => logger.warn('Failed to auto-copy screenshot', error));
      return;
    }
    if (piiStatus === 'pending') return;

    copiedRef.current = true;
    if (piiStatus === 'ocr-failed') {
      logger.warn('OCR failed; auto-copying with manual PII masks only');
    }
    exportRedacted()
      .then(copy)
      .catch((error) =>
        logger.warn('Failed to auto-copy redacted screenshot', error),
      );
  }, [
    enabled,
    piiPreferencesLoaded,
    censorPII,
    piiStatus,
    rawImageUrl,
    exportRedacted,
    copy,
  ]);
}

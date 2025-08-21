import { useEffect, useMemo, useRef, useState } from 'react';
import safeLocalStorage from '../../utils/storage';
import type { PiiMaskRect } from './types';

export function usePiiStorageKey(screenshot: {
  imageDataUrl: string;
  width: number;
  height: number;
}) {
  return useMemo(() => {
    const str = screenshot.imageDataUrl || '';
    const len = Math.min(4096, str.length);
    let hash = 0;
    for (let i = 0; i < len; i += 1) {
      hash = (hash * 31 + str.charCodeAt(i)) % 4294967291;
    }
    return `pii-masks:${screenshot.width}x${screenshot.height}:${hash.toString(16)}`;
  }, [screenshot.imageDataUrl, screenshot.width, screenshot.height]);
}

export function usePersistedPiiMasks(storageKey: string) {
  const [piiMasks, setPiiMasks] = useState<PiiMaskRect[]>([]);
  const piiMasksRef = useRef<PiiMaskRect[]>(piiMasks);

  useEffect(() => {
    piiMasksRef.current = piiMasks;
  }, [piiMasks]);

  useEffect(() => {
    const raw = safeLocalStorage.getItem(storageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as PiiMaskRect[];
        if (Array.isArray(parsed)) setPiiMasks(parsed);
      } catch {
        // swallow parse errors
      }
    }
  }, [storageKey]);

  useEffect(() => {
    safeLocalStorage.setItem(storageKey, JSON.stringify(piiMasks));
  }, [storageKey, piiMasks]);

  return { piiMasks, setPiiMasks, piiMasksRef } as const;
}

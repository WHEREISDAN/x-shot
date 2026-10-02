import { useCallback, useEffect, useState } from 'react';
import type {
  CaptureFailure,
  CaptureResult,
  ScreenshotResult,
} from '../../shared/ipc-types';
import { createRendererLogger } from '../utils/logger';
import { setCurrentCaptureSessionId } from '../utils/capture-session';

const logger = createRendererLogger('app');

type RendererIpc = Window['electron']['ipcRenderer'];

async function autoCopyIfEnabled(
  api: RendererIpc,
  screenshot: ScreenshotResult,
): Promise<void> {
  try {
    const preferences = await api.invoke('get-preferences', {});
    if (preferences?.capture?.autoCopyToClipboard) {
      await api.invoke('copy-image', { dataUrl: screenshot.imageDataUrl });
    }
  } catch (error) {
    logger.warn('Failed to auto-copy screenshot', error);
  }
}

export interface UseCaptureResult {
  screenshot: ScreenshotResult | null;
  failure: CaptureFailure | null;
  dismissFailure: () => void;
  clearScreenshot: () => void;
}

/**
 * Tracks the capture shown in the editor. A successful capture replaces it;
 * a failed capture only reports the failure and leaves it untouched.
 */
export function useCaptureResult(): UseCaptureResult {
  const [screenshot, setScreenshot] = useState<ScreenshotResult | null>(null);
  const [failure, setFailure] = useState<CaptureFailure | null>(null);

  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return () => {};
    return api.on('capture-result', (result: CaptureResult) => {
      if (!result.ok) {
        logger.warn('capture-editor-failure', {
          sessionId: result.sessionId,
          reason: result.reason,
        });
        setFailure(result);
        return;
      }

      const next = result.screenshot;
      setCurrentCaptureSessionId(next.sessionId);
      logger.info('capture-editor-received', {
        sessionId: next.sessionId,
        width: next.width,
        height: next.height,
      });
      setFailure(null);
      setScreenshot(next);
      autoCopyIfEnabled(api, next);
    });
  }, []);

  const dismissFailure = useCallback(() => setFailure(null), []);
  const clearScreenshot = useCallback(() => setScreenshot(null), []);

  return { screenshot, failure, dismissFailure, clearScreenshot };
}

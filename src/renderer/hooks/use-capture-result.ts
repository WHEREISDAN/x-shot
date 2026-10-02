import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  CaptureFailure,
  CaptureResult,
  ScreenshotResult,
} from '../../shared/ipc-types';
import { createRendererLogger } from '../utils/logger';
import { setCurrentCaptureSessionId } from '../utils/capture-session';

const logger = createRendererLogger('app');

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
  const screenshotRef = useRef<ScreenshotResult | null>(null);
  screenshotRef.current = screenshot;

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
    });
  }, []);

  const dismissFailure = useCallback(() => setFailure(null), []);
  // Main holds the pixels; a discarded capture frees them there too.
  const clearScreenshot = useCallback(() => {
    const { current } = screenshotRef;
    setScreenshot(null);
    if (!current) return;
    window?.electron?.ipcRenderer
      ?.invoke('release-capture-asset', { assetId: current.assetId })
      .catch((error) => logger.warn('Failed to release the capture', error));
  }, []);

  return { screenshot, failure, dismissFailure, clearScreenshot };
}

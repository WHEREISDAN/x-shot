import React, { useCallback } from 'react';
import type { PresentationSettings } from './use-presentation-state';
import {
  exportAnnotatedDataUrl,
  exportPresentedDataUrl,
} from '../components/editor/editor-export';
import { createRendererLogger } from '../utils/logger';
import { getCurrentCaptureSessionId } from '../utils/capture-session';

const logger = createRendererLogger('use-export-glue');

export interface UseExportGlueInput {
  stageRef: React.RefObject<HTMLElement>;
  natural: { width: number; height: number };
  presentation: PresentationSettings;
  setIsExporting?: (isExporting: boolean) => void;
}

export function useExportGlue({
  stageRef,
  natural,
  presentation,
  setIsExporting,
}: UseExportGlueInput) {
  const presentationDisabled =
    presentation.padding === 0 && presentation.inset === 0;

  const exportDataUrl = useCallback(async (): Promise<string> => {
    if (!stageRef.current) {
      throw new Error('Stage element not available for export');
    }

    let result: string = '';
    try {
      setIsExporting?.(true);

      // Give the DOM a moment to update and hide interactive elements
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 50);
      });

      // Force garbage collection if available (development)
      if (typeof window !== 'undefined' && 'gc' in window) {
        (window as any).gc();
      }

      const startTime = Date.now();

      if (presentationDisabled) {
        result = await exportAnnotatedDataUrl(stageRef.current, natural);
      } else {
        result = await exportPresentedDataUrl(
          stageRef.current,
          natural,
          presentation,
        );
      }

      const duration = Date.now() - startTime;
      logger.info('export-complete', {
        sessionId: getCurrentCaptureSessionId(),
        durationMs: duration,
        mode: presentationDisabled ? 'annotated' : 'presented',
        outputChars: result.length,
      });

      return result;
    } finally {
      // Always reset the exporting state
      setIsExporting?.(false);

      // Trigger cleanup after export
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => {
          // Force garbage collection if available
          if (typeof window !== 'undefined' && 'gc' in window) {
            (window as any).gc();
          }
        });
      }
    }
  }, [presentationDisabled, stageRef, natural, presentation, setIsExporting]);

  return { presentationDisabled, exportDataUrl };
}

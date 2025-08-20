import React, { useCallback } from 'react';
import type { PresentationSettings } from './use-presentation-state';
import type { EditorShape } from './use-editor-state';
import {
  exportAnnotatedDataUrl,
  exportPresentedDataUrl,
} from '../components/editor/editor-export';

export interface UseExportGlueInput {
  stageRef: React.RefObject<HTMLElement>;
  natural: { width: number; height: number };
  shapes: EditorShape[];
  presentation: PresentationSettings;
  setIsExporting?: (isExporting: boolean) => void;
}

export function useExportGlue({
  stageRef,
  natural,
  shapes,
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
      // Set exporting state to hide interactive elements
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
        result = await exportAnnotatedDataUrl(
          stageRef.current,
          natural,
          shapes,
        );
      } else {
        result = await exportPresentedDataUrl(
          stageRef.current,
          natural,
          shapes,
          presentation,
        );
      }

      const duration = Date.now() - startTime;
      console.log(`Total export pipeline took ${duration}ms`);

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
  }, [
    presentationDisabled,
    stageRef,
    natural,
    shapes,
    presentation,
    setIsExporting,
  ]);

  return { presentationDisabled, exportDataUrl };
}

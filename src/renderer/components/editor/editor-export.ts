// No shapes needed here because DOM export captures rendered shapes
import type { PresentationSettings } from '../../hooks/use-presentation-state';
import { exportAnnotatedDom, exportPresentationDom } from './editor-export-dom';

export async function exportAnnotatedDataUrl(
  stageElement: HTMLElement,
  natural: { width: number; height: number },
): Promise<string> {
  if (!stageElement) {
    throw new Error('Stage element is required for export');
  }

  // Calculate appropriate scale based on natural dimensions and current element size
  const currentWidth = stageElement.offsetWidth;
  const currentHeight = stageElement.offsetHeight;

  // Use a scale that ensures we get good quality but not excessive file size
  const scale = Math.min(
    2,
    Math.max(
      1,
      Math.min(natural.width / currentWidth, natural.height / currentHeight),
    ),
  );

  // Note: shapes are now rendered as DOM elements in the stage, so they're captured automatically
  return exportAnnotatedDom(stageElement, scale);
}

export async function exportPresentedDataUrl(
  stageElement: HTMLElement,
  natural: { width: number; height: number },
  settings: PresentationSettings,
): Promise<string> {
  if (!stageElement) {
    throw new Error('Stage element is required for export');
  }

  // When presentation is effectively disabled, fall back to plain export
  if (settings.padding === 0 && settings.inset === 0) {
    return exportAnnotatedDataUrl(stageElement, natural);
  }

  // Use the export scale from presentation settings
  const exportScale = settings.exportScale || 1;

  return exportPresentationDom(stageElement, exportScale);
}

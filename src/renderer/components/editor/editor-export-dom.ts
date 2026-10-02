import domtoimage from 'dom-to-image-more';
import { createRendererLogger } from '../../utils/logger';

const logger = createRendererLogger('editor-export-dom');

export interface DomExportOptions {
  /** The DOM element to capture */
  element: HTMLElement;
  scale?: number;
  backgroundColor?: string;
  filter?: (node: Node) => boolean;
}

/** Renders a DOM element to PNG bytes with dom-to-image-more. */
export async function exportDomToPng({
  element,
  scale = 1,
  backgroundColor = 'transparent',
  filter,
}: DomExportOptions): Promise<Uint8Array> {
  if (!element) {
    throw new Error('Element is required for DOM export');
  }

  // Ensure the element is visible and properly rendered
  if (element.offsetWidth === 0 || element.offsetHeight === 0) {
    throw new Error('Element has zero dimensions - cannot export');
  }

  // Calculate memory usage and apply limits
  const width = element.offsetWidth * scale;
  const height = element.offsetHeight * scale;
  const estimatedMemoryMB = (width * height * 4) / (1024 * 1024);

  // Prevent excessive memory usage
  const MAX_EXPORT_MEMORY_MB = 500; // 500MB limit
  let finalScale = scale;
  if (estimatedMemoryMB > MAX_EXPORT_MEMORY_MB) {
    const maxScale = Math.sqrt(
      MAX_EXPORT_MEMORY_MB / ((width * height * 4) / (1024 * 1024)),
    );
    finalScale = Math.min(scale, maxScale);
    logger.warn(
      `Export scale reduced from ${scale} to ${finalScale.toFixed(2)} to limit memory usage`,
    );
  }

  type DomToImageOptions = {
    width?: number;
    height?: number;
    scale?: number;
    style?: Record<string, string>;
    bgcolor?: string;
    quality?: number;
    cacheBust?: boolean;
    filter?: (node: Node) => boolean;
  };

  // `width` and `height` resize the cloned element itself, so they stay at
  // its layout size; `scale` enlarges only the output canvas. Scaling the
  // clone as well laid the background out at twice the size and kept only
  // its top-left quarter. The transform reset drops the editor's pan/zoom.
  const options: DomToImageOptions = {
    width: element.offsetWidth,
    height: element.offsetHeight,
    scale: finalScale,
    style: {
      transform: 'none',
    },
    quality: 0.92,
    cacheBust: true,
  };

  if (backgroundColor && backgroundColor !== 'transparent') {
    options.bgcolor = backgroundColor;
  }

  if (filter) {
    options.filter = filter;
  }

  try {
    const startTime = Date.now();
    // Same canvas and encoder as toPng, so the bytes are identical.
    const blob = await domtoimage.toBlob(element, options);
    if (!blob) throw new Error('The export canvas produced no image');
    const png = new Uint8Array(await blob.arrayBuffer());
    const duration = Date.now() - startTime;
    logger.info(
      `Export completed in ${duration}ms (${Math.round(estimatedMemoryMB)}MB)`,
    );

    return png;
  } catch (error) {
    logger.error('Failed to export DOM to image', error);
    throw new Error(
      `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Export DOM element specifically for presentation mode
 * This captures the styled presentation background, shadows, and framing
 */
export async function exportPresentationDom(
  element: HTMLElement,
  exportScale: number = 1,
): Promise<Uint8Array> {
  return exportDomToPng({
    element,
    scale: exportScale,
    backgroundColor: 'transparent',
    filter: (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const nodeElement = node as Element;

        if (nodeElement.hasAttribute('data-export-exclude')) {
          return false;
        }

        if (
          nodeElement.classList.contains('selection-overlay') ||
          nodeElement.classList.contains('resize-handle') ||
          nodeElement.classList.contains('ocr-overlay')
        ) {
          return false;
        }
      }

      return true;
    },
  });
}

/**
 * Export DOM element for non-presentation mode (simple/annotated export)
 * This captures just the screenshot with annotations, no decorative framing
 */
export async function exportAnnotatedDom(
  element: HTMLElement,
  exportScale: number = 1,
): Promise<Uint8Array> {
  return exportDomToPng({
    element,
    scale: exportScale,
    backgroundColor: 'transparent',
    filter: (node: Node) => {
      // Filter out any elements that shouldn't be in the export
      if (node.nodeType === Node.ELEMENT_NODE) {
        const nodeElement = node as Element;

        // Skip elements with data-export-exclude attribute
        if (nodeElement.hasAttribute('data-export-exclude')) {
          return false;
        }

        // Skip any selection overlays or interactive elements
        if (
          nodeElement.classList.contains('selection-overlay') ||
          nodeElement.classList.contains('resize-handle') ||
          nodeElement.classList.contains('ocr-overlay')
        ) {
          return false;
        }
      }

      return true;
    },
  });
}

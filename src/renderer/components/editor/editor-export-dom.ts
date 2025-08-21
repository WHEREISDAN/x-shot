import domtoimage from 'dom-to-image-more';
import { createRendererLogger } from '../../utils/logger';

const logger = createRendererLogger('editor-export-dom');

export interface DomExportOptions {
  /** The DOM element to capture (should be the main stage div) */
  element: HTMLElement;
  /** Scale factor for the export (default: 1) */
  scale?: number;
  /** Background color for transparent areas (default: transparent) */
  backgroundColor?: string;
  /** Filter function to exclude certain nodes during export */
  filter?: (node: Node) => boolean;
}

/**
 * Export a DOM element to a data URL using dom-to-image-more
 * This replaces the canvas-based export logic with direct DOM capture
 */
export async function exportDomToDataUrl({
  element,
  scale = 1,
  backgroundColor = 'transparent',
  filter,
}: DomExportOptions): Promise<string> {
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
    style?: Record<string, string>;
    bgcolor?: string;
    quality?: number;
    cacheBust?: boolean;
    filter?: (node: Node) => boolean;
  };

  const options: DomToImageOptions = {
    width: element.offsetWidth * finalScale,
    height: element.offsetHeight * finalScale,
    style: {
      transform: `scale(${finalScale})`,
      transformOrigin: 'top left',
    },
    // Enable memory optimizations
    quality: 0.92, // Slightly reduce quality for better compression
    cacheBust: true, // Prevent caching issues
  };

  // Add background color if specified and not transparent
  if (backgroundColor && backgroundColor !== 'transparent') {
    options.bgcolor = backgroundColor;
  }

  // Add filter if provided
  if (filter) {
    options.filter = filter;
  }

  try {
    const startTime = Date.now();
    const dataUrl = await domtoimage.toPng(element, options);
    const duration = Date.now() - startTime;
    logger.info(
      `Export completed in ${duration}ms (${Math.round(estimatedMemoryMB)}MB)`,
    );

    return dataUrl;
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
): Promise<string> {
  return exportDomToDataUrl({
    element,
    scale: exportScale,
    backgroundColor: 'transparent', // Preserve the gradient background from CSS
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

/**
 * Export DOM element for non-presentation mode (simple/annotated export)
 * This captures just the screenshot with annotations, no decorative framing
 */
export async function exportAnnotatedDom(
  element: HTMLElement,
  exportScale: number = 1,
): Promise<string> {
  return exportDomToDataUrl({
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

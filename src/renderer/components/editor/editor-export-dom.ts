import domtoimage from 'dom-to-image-more';

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

  const options: any = {
    width: element.offsetWidth * scale,
    height: element.offsetHeight * scale,
    style: {
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    },
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
    const dataUrl = await domtoimage.toPng(element, options);
    return dataUrl;
  } catch (error) {
    console.error('Failed to export DOM to image:', error);
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

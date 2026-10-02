export interface OcrCanvas {
  canvas: HTMLCanvasElement;
  /** Canvas pixels per image pixel. */
  scale: number;
  cleanup: () => void;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Capture assets come from another origin; a CORS load keeps the canvas
    // readable for OCR.
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load the capture: ${url}`));
    img.src = url;
  });
}

function scaleImageToCanvas(img: HTMLImageElement, maxDim: number): OcrCanvas {
  const { naturalWidth, naturalHeight } = img;
  const maxInput = Math.max(naturalWidth, naturalHeight);
  const scale = maxInput > maxDim ? maxDim / maxInput : 1;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2D context');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(
    img,
    0,
    0,
    naturalWidth,
    naturalHeight,
    0,
    0,
    canvas.width,
    canvas.height,
  );

  const cleanup = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.width = 1;
    canvas.height = 1;
  };

  return { canvas, scale, cleanup };
}

/** Decodes a capture and draws it onto a canvas no larger than maxDim. */
export async function prepareOcrCanvas(
  imageUrl: string,
  maxDim: number,
): Promise<OcrCanvas> {
  const img = await loadImage(imageUrl);
  return scaleImageToCanvas(img, maxDim);
}

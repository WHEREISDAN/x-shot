import type { PresentationSettings } from '../../hooks/use-presentation-state';

export interface Layout {
  canvas: { width: number; height: number };
  frame: {
    x: number;
    y: number;
    width: number;
    height: number;
    radius: number;
  };
  shot: { x: number; y: number; width: number; height: number };
}

export function computeLayout(
  nw: number,
  nh: number,
  s: PresentationSettings,
): Layout {
  // Calculate frame size independently of aspect ratio
  // Frame should always accommodate the original image with proper scaling + inset
  const frameWidth = Math.max(1, nw + s.inset * 2);
  const frameHeight = Math.max(1, nh + s.inset * 2);

  // Calculate canvas size based on aspect ratio settings
  const resolveCanvasAspect = (): { width: number; height: number } => {
    if (s.aspect.preset === 'auto') {
      // Auto: canvas fits frame + padding
      return {
        width: frameWidth + s.padding * 2,
        height: frameHeight + s.padding * 2,
      };
    }

    // For preset ratios, determine minimum canvas size that can contain frame + padding
    const { preset } = s.aspect;
    const custom = s.aspect.custom ?? { w: nw, h: nh };
    let aw = custom.w;
    let ah = custom.h;

    switch (preset) {
      case '1:1': {
        aw = 1;
        ah = 1;
        break;
      }
      case '4:3': {
        aw = 4;
        ah = 3;
        break;
      }
      case '3:2': {
        aw = 3;
        ah = 2;
        break;
      }
      case '16:9': {
        aw = 16;
        ah = 9;
        break;
      }
      case '9:16': {
        aw = 9;
        ah = 16;
        break;
      }
      case 'custom':
      default: {
        aw = custom.w;
        ah = custom.h;
        break;
      }
    }

    const ratio = aw / ah;

    // Minimum canvas size needed to fit frame + padding
    const minCanvasW = frameWidth + s.padding * 2;
    const minCanvasH = frameHeight + s.padding * 2;

    // Find canvas size that respects aspect ratio and fits the frame
    const canvasWFromH = Math.ceil(minCanvasH * ratio);
    const canvasHFromW = Math.ceil(minCanvasW / ratio);

    if (canvasWFromH >= minCanvasW) {
      // Height-constrained: use minimum height, derive width from ratio
      return { width: canvasWFromH, height: minCanvasH };
    }
    // Width-constrained: use minimum width, derive height from ratio
    return { width: minCanvasW, height: canvasHFromW };
  };

  const canvas = resolveCanvasAspect();

  // Frame is always centered within the canvas, with padding creating the gap
  const frameX = Math.round((canvas.width - frameWidth) / 2);
  const frameY = Math.round((canvas.height - frameHeight) / 2);

  // Shot (original image) is scaled to fit within the frame accounting for inset
  const innerW = Math.max(1, frameWidth - s.inset * 2);
  const innerH = Math.max(1, frameHeight - s.inset * 2);
  const scale = Math.min(innerW / nw, innerH / nh);
  const shotW = Math.round(nw * scale);
  const shotH = Math.round(nh * scale);

  // Position shot centered within the frame, accounting for inset
  const shotX = frameX + s.inset + Math.round((innerW - shotW) / 2);
  const shotY = frameY + s.inset + Math.round((innerH - shotH) / 2);

  const radius = Math.min(
    s.radius,
    Math.floor(Math.min(frameWidth, frameHeight) / 2),
  );

  return {
    canvas: { width: canvas.width, height: canvas.height },
    frame: {
      x: frameX,
      y: frameY,
      width: frameWidth,
      height: frameHeight,
      radius,
    },
    shot: { x: shotX, y: shotY, width: shotW, height: shotH },
  };
}

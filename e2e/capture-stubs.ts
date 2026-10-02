import fs from 'fs';
import { expect, type Page } from '@playwright/test';
import { editorFor, type PackagedApp } from './packaged-app';

export const FAKE_WINDOW_ID = 'window:4242:0';
export const FAKE_WINDOW_NAME = 'Fixture window';

export interface Size {
  width: number;
  height: number;
}

export interface SourceStubs {
  /** PNG file shown as every screen. */
  screenPng: string;
  /** PNG file of the one window, at its native size; or random pixels. */
  window: { png: string } | { noise: Size };
}

/**
 * Replaces desktopCapturer.getSources with fixture sources. Like Chromium, a
 * window thumbnail is scaled to fill the requested box, so only a request for
 * the window's exact size returns it unscaled. Every window thumbnail is a
 * fresh bitmap, so no cached PNG encoding is reused. Requested window sizes
 * are recorded.
 */
export async function stubCaptureSources(
  { app }: PackagedApp,
  stubs: SourceStubs,
): Promise<void> {
  const screenBase64 = fs.readFileSync(stubs.screenPng).toString('base64');
  const windowSource: { pngBase64?: string; noise?: Size } =
    'png' in stubs.window
      ? { pngBase64: fs.readFileSync(stubs.window.png).toString('base64') }
      : { noise: stubs.window.noise };
  await app.evaluate(
    ({ desktopCapturer, nativeImage, screen }, input) => {
      const requests: Array<{ width: number; height: number }> = [];
      Object.assign(global, { xshotWindowRequests: requests });
      const screenImage = nativeImage.createFromBuffer(
        Buffer.from(input.screenBase64, 'base64'),
      );
      const { pngBase64, noise: noiseSize } = input.windowSource;
      const windowImage = pngBase64
        ? nativeImage.createFromBuffer(Buffer.from(pngBase64, 'base64'))
        : null;
      const nativeSize = windowImage?.getSize() ??
        noiseSize ?? { width: 1, height: 1 };
      const noise = (length: number) => {
        const bytes = Buffer.alloc(length);
        // Park-Miller: incompressible pixels without bitwise operators.
        let seed = 2463534;
        for (let i = 0; i < length; i += 1) {
          seed = (seed * 16807) % 2147483647;
          bytes[i] = i % 4 === 3 ? 255 : seed % 256;
        }
        return bytes;
      };
      const bitmap = windowImage
        ? windowImage.toBitmap()
        : noise(nativeSize.width * nativeSize.height * 4);
      const fit = (box: { width: number; height: number }) => {
        const scale = Math.min(
          box.width / nativeSize.width,
          box.height / nativeSize.height,
        );
        return {
          width: Math.round(nativeSize.width * scale),
          height: Math.round(nativeSize.height * scale),
        };
      };

      Object.assign(desktopCapturer, {
        getSources: async (options: {
          types: string[];
          thumbnailSize?: { width: number; height: number };
        }) => {
          const box = options.thumbnailSize ?? { width: 150, height: 150 };
          if (options.types.includes('screen')) {
            return screen.getAllDisplays().map((display, i) => ({
              id: `screen:${i}:0`,
              name: `Screen ${i + 1}`,
              display_id: String(display.id),
              appIcon: null,
              thumbnail: screenImage.resize(box),
            }));
          }
          requests.push(box);
          const image = nativeImage
            .createFromBitmap(bitmap, nativeSize)
            .resize(fit(box));
          return [
            {
              id: 'window:4242:0',
              name: 'Fixture window',
              display_id: '',
              appIcon: nativeImage.createFromBitmap(bitmap, nativeSize).crop({
                x: 0,
                y: 0,
                width: 16,
                height: 16,
              }),
              thumbnail: image,
            },
          ];
        },
      });
    },
    { screenBase64, windowSource },
  );
}

export async function requestedWindowSizes({
  app,
}: PackagedApp): Promise<Size[]> {
  return app.evaluate(
    () =>
      (global as unknown as { xshotWindowRequests: Size[] })
        .xshotWindowRequests,
  );
}

/**
 * Makes getUserMedia in the editor page return a stream of `size`, as a real
 * window source of that native size would.
 */
export async function stubWindowFrameSize(
  { window: page }: PackagedApp,
  size: Size,
): Promise<void> {
  await page.evaluate((frame) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement('canvas');
      canvas.width = frame.width;
      canvas.height = frame.height;
      canvas.getContext('2d')?.fillRect(0, 0, 1, 1);
      return canvas.captureStream();
    };
  }, size);
}

/** The session id the editor shows, or null without a capture. */
export async function shownSessionId(page: Page): Promise<string | null> {
  const editor = page.locator('[data-session-id]');
  return (await editor.count()) > 0
    ? editor.getAttribute('data-session-id')
    : null;
}

/** The size of the capture the editor shows, from its stage. */
export async function shownCaptureSize(
  page: Page,
  sessionId: string,
): Promise<Size> {
  const image = editorFor(page, { sessionId }).getByAltText('Screenshot');
  await expect
    .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBeGreaterThan(0);
  return image.evaluate((img: HTMLImageElement) => ({
    width: img.naturalWidth,
    height: img.naturalHeight,
  }));
}

/**
 * Picks a window from an open overlay and waits for the editor to show the
 * new capture. Returns its session id.
 */
export async function captureWindowFromOverlay(
  packaged: PackagedApp,
  overlay: Page,
  sourceId: string,
): Promise<string> {
  const before = await shownSessionId(packaged.window);
  // The coordinator ignores a confirmation until the overlays are ready.
  await expect(async () => {
    if (!overlay.isClosed()) {
      await overlay
        .evaluate(
          (id) =>
            window.electron.ipcRenderer.sendMessage('screenshot-window', {
              sourceId: id,
            }),
          sourceId,
        )
        .catch(() => {});
    }
    const now = await shownSessionId(packaged.window);
    expect(now && now !== before).toBeTruthy();
  }).toPass({ timeout: 30_000 });
  return (await shownSessionId(packaged.window)) as string;
}

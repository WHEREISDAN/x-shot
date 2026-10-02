import type { WebContents } from 'electron';
import type { Size } from '../shared/crop-geometry';

const WINDOW_SOURCE_ID = /^window:\d+:\d+$/;
const MEASURE_TIMEOUT_MS = 3000;
// Frames above this are scaled down by the capturer.
const MAX_FRAME = 8192;

/**
 * Renderer code that opens the window source as video and reads the size of
 * its first frame, which is the window at its native resolution. The stream
 * is always stopped, even when no frame arrives in time.
 */
function measureScript(sourceId: string): string {
  return `(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: ${JSON.stringify(sourceId)},
          maxWidth: ${MAX_FRAME},
          maxHeight: ${MAX_FRAME},
        },
      },
    });
    try {
      const video = document.createElement('video');
      video.muted = true;
      video.srcObject = stream;
      await new Promise((resolve, reject) => {
        video.onloadedmetadata = resolve;
        setTimeout(() => reject(new Error('No frame')), ${MEASURE_TIMEOUT_MS - 500});
      });
      return { width: video.videoWidth, height: video.videoHeight };
    } finally {
      stream.getTracks().forEach((track) => track.stop());
    }
  })()`;
}

function isFrameSize(value: unknown): value is Size {
  const size = value as Partial<Size> | null;
  return (
    typeof size?.width === 'number' &&
    typeof size.height === 'number' &&
    size.width >= 1 &&
    size.height >= 1 &&
    size.width <= MAX_FRAME &&
    size.height <= MAX_FRAME
  );
}

/**
 * The native pixel size of a window source. desktopCapturer scales window
 * thumbnails to fill the requested box, so asking for exactly this size is
 * the only way to get the window unscaled. Null when it cannot be measured.
 */
export default async function measureWindowSource(
  contents: WebContents,
  sourceId: string,
): Promise<Size | null> {
  if (!WINDOW_SOURCE_ID.test(sourceId) || contents.isDestroyed()) return null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
  });
  const measured = contents
    .executeJavaScript(measureScript(sourceId), true)
    .then((size: unknown) => (isFrameSize(size) ? size : null))
    .catch(() => null);
  const size = await Promise.race([measured, timeout]);
  clearTimeout(timer);
  return size;
}

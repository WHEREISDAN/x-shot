import { nativeImage } from 'electron';
import { captureAssets } from './capture-assets';

export interface E2eHooks {
  /**
   * Stores PNG bytes as a delivered capture of `sessionId`, releasing the
   * capture it replaces the way a real delivery does.
   */
  addCapture: (input: {
    sessionId: string;
    pngBase64: string;
    scaleFactor: number;
  }) => { assetId: string; width: number; height: number };
  assetCount: () => number;
}

/**
 * Lets the packaged smoke tests put fixture bytes into the capture store.
 * Installed only when the app is launched with XSHOT_E2E=1, and reachable
 * only from main-process code, never from a renderer.
 */
export default function installE2eHooks(): void {
  if (process.env.XSHOT_E2E !== '1') return;
  const hooks: E2eHooks = {
    addCapture: ({ sessionId, pngBase64, scaleFactor }) => {
      const png = Buffer.from(pngBase64, 'base64');
      const { width, height } = nativeImage.createFromBuffer(png).getSize();
      const asset = captureAssets.add({
        sessionId,
        kind: 'capture',
        width,
        height,
        scaleFactor,
        encode: () => png,
      });
      captureAssets.releaseWhere((stored) => stored.sessionId !== sessionId);
      return { assetId: asset.assetId, width, height };
    },
    assetCount: () => captureAssets.size(),
  };
  Object.assign(global, { xshotE2E: hooks });
}

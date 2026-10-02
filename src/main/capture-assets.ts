import { randomUUID } from 'crypto';
import type { CaptureAssetRef } from '../shared/capture-asset';

/**
 * capture: the image delivered to the editor; snapshot: a display's frozen
 * overlay background; preview: a source thumbnail or icon in the overlay.
 */
export type CaptureAssetKind = 'capture' | 'snapshot' | 'preview';

export interface CaptureAsset extends CaptureAssetRef {
  sessionId: string;
  kind: CaptureAssetKind;
  /** The PNG bytes, encoded on first use and then kept. */
  png: () => Buffer;
}

export interface NewCaptureAsset extends Omit<CaptureAssetRef, 'assetId'> {
  sessionId: string;
  kind: CaptureAssetKind;
  encode: () => Buffer;
}

export interface CaptureAssetStore {
  add: (asset: NewCaptureAsset) => CaptureAsset;
  get: (assetId: string) => CaptureAsset | undefined;
  release: (assetId: string) => boolean;
  releaseWhere: (drop: (asset: CaptureAsset) => boolean) => void;
  size: () => number;
}

/**
 * In-memory PNG store for capture images. Ids are random and generated here,
 * so a renderer can only ever name an asset main handed to it.
 */
export function createCaptureAssetStore(
  newId: () => string = randomUUID,
): CaptureAssetStore {
  const assets = new Map<string, CaptureAsset>();

  return {
    add: ({ encode, ...input }) => {
      if (input.width < 1 || input.height < 1) {
        throw new Error('The captured image is empty.');
      }
      let encoded: Buffer | null = null;
      // Dropped after the first encode, freeing whatever image it holds.
      let source: (() => Buffer) | null = encode;
      const asset: CaptureAsset = {
        ...input,
        assetId: newId(),
        png: () => {
          if (!encoded && source) {
            encoded = source();
            source = null;
          }
          return encoded ?? Buffer.alloc(0);
        },
      };
      assets.set(asset.assetId, asset);
      return asset;
    },
    get: (assetId) => assets.get(assetId),
    release: (assetId) => assets.delete(assetId),
    releaseWhere: (drop) => {
      Array.from(assets.values())
        .filter(drop)
        .forEach((asset) => assets.delete(asset.assetId));
    },
    size: () => assets.size,
  };
}

export const captureAssets = createCaptureAssetStore();

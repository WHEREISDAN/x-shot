import { randomUUID } from 'crypto';
import type { CaptureAssetRef } from '../shared/capture-asset';

export interface CaptureAsset extends CaptureAssetRef {
  sessionId: string;
  png: Buffer;
}

export type NewCaptureAsset = Omit<CaptureAsset, 'assetId'>;

export interface CaptureAssetStore {
  add: (asset: NewCaptureAsset) => CaptureAsset;
  get: (assetId: string) => CaptureAsset | undefined;
  release: (assetId: string) => boolean;
  /** Drops every asset of one capture session. */
  releaseSession: (sessionId: string) => void;
  /** Drops every asset except those of `sessionId`. */
  releaseAllExcept: (sessionId: string) => void;
  size: () => number;
}

/**
 * In-memory PNG store for captures. Ids are random and generated here, so a
 * renderer can only ever name an asset main handed to it.
 */
export function createCaptureAssetStore(
  newId: () => string = randomUUID,
): CaptureAssetStore {
  const assets = new Map<string, CaptureAsset>();

  const removeWhere = (drop: (asset: CaptureAsset) => boolean) => {
    Array.from(assets.values())
      .filter(drop)
      .forEach((asset) => assets.delete(asset.assetId));
  };

  return {
    add: (input) => {
      if (input.png.length === 0 || input.width < 1 || input.height < 1) {
        throw new Error('The captured image is empty.');
      }
      const asset = { ...input, assetId: newId() };
      assets.set(asset.assetId, asset);
      return asset;
    },
    get: (assetId) => assets.get(assetId),
    release: (assetId) => assets.delete(assetId),
    releaseSession: (sessionId) =>
      removeWhere((asset) => asset.sessionId === sessionId),
    releaseAllExcept: (sessionId) =>
      removeWhere((asset) => asset.sessionId !== sessionId),
    size: () => assets.size,
  };
}

export const captureAssets = createCaptureAssetStore();

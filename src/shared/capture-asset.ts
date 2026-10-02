// Captures and background images stay in main and reach renderers through
// this scheme, so no image is ever copied over IPC as a data URL.
export const CAPTURE_ASSET_SCHEME = 'xshot-asset';

const ASSET_HOST = 'capture';
const BACKGROUND_HOST = 'background';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ASSET_ID = new RegExp(`^${UUID}$`);
const BACKGROUND_ID = new RegExp(`^${UUID}\\.(?:png|jpg|webp|gif)$`);

/** A capture held by main, as the editor receives it. */
export interface CaptureAssetRef {
  assetId: string;
  /** Image size in physical pixels. */
  width: number;
  height: number;
  /** Physical pixels per DIP of the display the capture came from. */
  scaleFactor: number;
}

export function isCaptureAssetId(value: unknown): value is string {
  return typeof value === 'string' && ASSET_ID.test(value);
}

/** A stored background file name: a random id and an image extension. */
export function isBackgroundId(value: unknown): value is string {
  return typeof value === 'string' && BACKGROUND_ID.test(value);
}

export function captureAssetUrl(assetId: string): string {
  return `${CAPTURE_ASSET_SCHEME}://${ASSET_HOST}/${assetId}`;
}

export function backgroundAssetUrl(id: string): string {
  return `${CAPTURE_ASSET_SCHEME}://${BACKGROUND_HOST}/${id}`;
}

export type AssetTarget =
  | { kind: 'capture'; id: string }
  | { kind: 'background'; id: string };

/** What an asset URL points at, or null for anything else. */
export function assetTargetFromUrl(url: string): AssetTarget | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${CAPTURE_ASSET_SCHEME}:`) return null;
  const id = parsed.pathname.slice(1);
  if (parsed.host === ASSET_HOST && isCaptureAssetId(id)) {
    return { kind: 'capture', id };
  }
  if (parsed.host === BACKGROUND_HOST && isBackgroundId(id)) {
    return { kind: 'background', id };
  }
  return null;
}

/** The capture asset id a URL points at, or null for anything else. */
export function captureAssetIdFromUrl(url: string): string | null {
  const target = assetTargetFromUrl(url);
  return target?.kind === 'capture' ? target.id : null;
}

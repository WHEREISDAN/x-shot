// Captures stay in main and reach renderers through this scheme, so no
// image is ever copied over IPC as a data URL.
export const CAPTURE_ASSET_SCHEME = 'xshot-asset';

const ASSET_HOST = 'capture';
const ASSET_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

export function captureAssetUrl(assetId: string): string {
  return `${CAPTURE_ASSET_SCHEME}://${ASSET_HOST}/${assetId}`;
}

/** The asset id a URL points at, or null for anything else. */
export function captureAssetIdFromUrl(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== `${CAPTURE_ASSET_SCHEME}:`) return null;
  if (parsed.host !== ASSET_HOST) return null;
  const id = parsed.pathname.slice(1);
  return isCaptureAssetId(id) ? id : null;
}

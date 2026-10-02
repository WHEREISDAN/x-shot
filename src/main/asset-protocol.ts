import { protocol } from 'electron';
import {
  CAPTURE_ASSET_SCHEME,
  captureAssetIdFromUrl,
} from '../shared/capture-asset';
import { captureAssets, type CaptureAssetStore } from './capture-assets';

// Renderers load from file:// (or the dev server), so every response allows
// any origin; canvases that read the pixels stay untainted.
const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' };

/** Must run before the app is ready. */
export function registerAssetScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: CAPTURE_ASSET_SCHEME,
      privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        corsEnabled: true,
      },
    },
  ]);
}

/** Serves a stored asset by id; anything else is a 404. */
export function respondToAssetRequest(
  store: CaptureAssetStore,
  request: Request,
): Response {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }
  const assetId = captureAssetIdFromUrl(request.url);
  const asset = assetId ? store.get(assetId) : undefined;
  if (!asset) {
    return new Response(null, { status: 404, headers: CORS_HEADERS });
  }
  const { buffer, byteOffset, length } = asset.png;
  return new Response(new Uint8Array(buffer, byteOffset, length), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'image/png',
      'Content-Length': String(asset.png.length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Must run once the app is ready. */
export function handleAssetProtocol(
  store: CaptureAssetStore = captureAssets,
): void {
  protocol.handle(CAPTURE_ASSET_SCHEME, (request) =>
    respondToAssetRequest(store, request),
  );
}

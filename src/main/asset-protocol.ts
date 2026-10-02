import { protocol } from 'electron';
import {
  CAPTURE_ASSET_SCHEME,
  assetTargetFromUrl,
} from '../shared/capture-asset';
import type { BackgroundStore } from './background-images';
import type { CaptureAssetStore } from './capture-assets';

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

export interface AssetSources {
  captures: CaptureAssetStore;
  backgrounds: Pick<BackgroundStore, 'read'>;
}

const notFound = () =>
  new Response(null, { status: 404, headers: CORS_HEADERS });

function captureResponse(
  captures: CaptureAssetStore,
  assetId: string,
): Response {
  const asset = captures.get(assetId);
  const png = asset?.png();
  if (!png || png.length === 0) return notFound();
  const { buffer, byteOffset, length } = png;
  return new Response(new Uint8Array(buffer, byteOffset, length), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'image/png',
      'Content-Length': String(length),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

async function backgroundResponse(
  backgrounds: AssetSources['backgrounds'],
  id: string,
): Promise<Response> {
  const image = await backgrounds.read(id);
  if (!image) return notFound();
  const { buffer, byteOffset, length } = image.bytes;
  return new Response(new Uint8Array(buffer, byteOffset, length), {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': image.contentType,
      'Content-Length': String(length),
      // A background id always names the same bytes.
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/** Serves a stored capture or background by id; anything else is a 404. */
export async function respondToAssetRequest(
  sources: AssetSources,
  request: Request,
): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(null, { status: 405, headers: CORS_HEADERS });
  }
  const target = assetTargetFromUrl(request.url);
  if (target?.kind === 'capture') {
    return captureResponse(sources.captures, target.id);
  }
  if (target?.kind === 'background') {
    return backgroundResponse(sources.backgrounds, target.id);
  }
  return notFound();
}

/** Must run once the app is ready. */
export function handleAssetProtocol(sources: AssetSources): void {
  protocol.handle(CAPTURE_ASSET_SCHEME, (request) =>
    respondToAssetRequest(sources, request),
  );
}

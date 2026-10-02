/**
 * @jest-environment node
 */
import { protocol } from 'electron';
import {
  captureAssetIdFromUrl,
  captureAssetUrl,
  isCaptureAssetId,
} from '../shared/capture-asset';
import {
  createCaptureAssetStore,
  type CaptureAsset,
  type CaptureAssetKind,
  type NewCaptureAsset,
} from '../main/capture-assets';
import {
  handleAssetProtocol,
  registerAssetScheme,
  respondToAssetRequest,
} from '../main/asset-protocol';

jest.mock('electron', () => ({
  protocol: { registerSchemesAsPrivileged: jest.fn(), handle: jest.fn() },
}));

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const UNKNOWN_ID = '0b7c2d4e-1f3a-4b5c-8d6e-7f8091a2b3c4';

const capture = (
  sessionId: string,
  kind: CaptureAssetKind = 'capture',
  encode = jest.fn(() => PNG),
): NewCaptureAsset => ({
  sessionId,
  kind,
  width: 4,
  height: 3,
  scaleFactor: 2,
  encode,
});

const ofSession = (sessionId: string) => (asset: CaptureAsset) =>
  asset.sessionId === sessionId;
const notOfSession = (sessionId: string) => (asset: CaptureAsset) =>
  asset.sessionId !== sessionId;

const get = (url: string, method = 'GET') => new Request(url, { method });

describe('capture asset URLs', () => {
  it('round-trips an id through its URL', () => {
    const url = captureAssetUrl(UNKNOWN_ID);
    expect(url).toBe(`xshot-asset://capture/${UNKNOWN_ID}`);
    expect(captureAssetIdFromUrl(url)).toBe(UNKNOWN_ID);
    expect(captureAssetIdFromUrl(`${url}?1712345678`)).toBe(UNKNOWN_ID);
  });

  it.each([
    `xshot-asset://other/${UNKNOWN_ID}`,
    `https://capture/${UNKNOWN_ID}`,
    'xshot-asset://capture/../../etc/passwd',
    'xshot-asset://capture/%2e%2e%2fsecret',
    `xshot-asset://capture/${UNKNOWN_ID}/extra`,
    'data:image/png;base64,AAAA',
    'not a url',
  ])('rejects %s', (url) => {
    expect(captureAssetIdFromUrl(url)).toBeNull();
  });

  it('accepts only generated ids', () => {
    expect(isCaptureAssetId(UNKNOWN_ID)).toBe(true);
    expect(isCaptureAssetId(UNKNOWN_ID.toUpperCase())).toBe(false);
    expect(isCaptureAssetId('')).toBe(false);
    expect(isCaptureAssetId(42)).toBe(false);
  });
});

describe('createCaptureAssetStore', () => {
  it('stores an image under a fresh opaque id', () => {
    const store = createCaptureAssetStore();
    const a = store.add(capture('s1'));
    const b = store.add(capture('s1'));
    expect(isCaptureAssetId(a.assetId)).toBe(true);
    expect(a.assetId).not.toBe(b.assetId);
    expect(store.get(a.assetId)?.png()).toBe(PNG);
  });

  it('encodes once, on first use, and then drops the source image', () => {
    const store = createCaptureAssetStore();
    const encode = jest.fn(() => PNG);
    const asset = store.add(capture('s1', 'snapshot', encode));
    expect(encode).not.toHaveBeenCalled();
    expect(asset.png()).toBe(PNG);
    expect(asset.png()).toBe(PNG);
    expect(encode).toHaveBeenCalledTimes(1);
  });

  it('refuses an image without pixels', () => {
    const store = createCaptureAssetStore();
    expect(() => store.add({ ...capture('s1'), width: 0 })).toThrow(
      'The captured image is empty.',
    );
    expect(() => store.add({ ...capture('s1'), height: 0 })).toThrow();
    expect(store.size()).toBe(0);
  });

  it('releases a session when it ends without delivering', () => {
    const store = createCaptureAssetStore();
    const kept = store.add(capture('delivered'));
    const dropped = store.add(capture('failed'));
    store.releaseWhere(ofSession('failed'));
    expect(store.get(dropped.assetId)).toBeUndefined();
    expect(store.get(kept.assetId)).toBeDefined();
  });

  it('releases the previous capture when a new one is delivered', () => {
    const store = createCaptureAssetStore();
    const first = store.add(capture('s1'));
    const second = store.add(capture('s2'));
    store.releaseWhere(notOfSession('s2'));
    expect(store.get(first.assetId)).toBeUndefined();
    expect(store.get(second.assetId)).toBeDefined();
  });

  it('releases a single discarded asset', () => {
    const store = createCaptureAssetStore();
    const asset = store.add(capture('s1'));
    expect(store.release(asset.assetId)).toBe(true);
    expect(store.release(asset.assetId)).toBe(false);
    expect(store.size()).toBe(0);
  });

  it('does not grow over 20 sessions', () => {
    const store = createCaptureAssetStore();
    const sizes = Array.from({ length: 20 }, (_, i) => {
      const session = `s${i}`;
      // Each session shows two snapshots and a preview in its overlays.
      store.add(capture(session, 'snapshot'));
      store.add(capture(session, 'snapshot'));
      store.add(capture(session, 'preview'));
      const delivered = i % 4 !== 3;
      if (delivered) {
        store.add(capture(session));
        store.releaseWhere(notOfSession(session));
      }
      // Session end: overlay images go; an undelivered capture goes too.
      store.releaseWhere(
        (asset) =>
          asset.sessionId === session &&
          (asset.kind !== 'capture' || !delivered),
      );
      return store.size();
    });
    expect(Math.max(...sizes)).toBe(1);
  });
});

describe('respondToAssetRequest', () => {
  it('serves a stored capture as an untainted PNG', async () => {
    const store = createCaptureAssetStore();
    const { assetId } = store.add(capture('s1'));
    const response = respondToAssetRequest(
      store,
      get(captureAssetUrl(assetId)),
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('image/png');
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(PNG);
  });

  it('ignores a cache-busting query', () => {
    const store = createCaptureAssetStore();
    const { assetId } = store.add(capture('s1'));
    const url = `${captureAssetUrl(assetId)}?1712345678`;
    expect(respondToAssetRequest(store, get(url)).status).toBe(200);
  });

  it.each([
    captureAssetUrl(UNKNOWN_ID),
    'xshot-asset://capture/not-an-id',
    'xshot-asset://other/0b7c2d4e-1f3a-4b5c-8d6e-7f8091a2b3c4',
  ])('answers 404 for %s', (url) => {
    const store = createCaptureAssetStore();
    store.add(capture('s1'));
    const response = respondToAssetRequest(store, get(url));
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toBeNull();
  });

  it('answers 404 once the asset is released', () => {
    const store = createCaptureAssetStore();
    const { assetId } = store.add(capture('s1'));
    store.releaseWhere(ofSession('s1'));
    const response = respondToAssetRequest(
      store,
      get(captureAssetUrl(assetId)),
    );
    expect(response.status).toBe(404);
  });

  it('refuses anything but GET', () => {
    const store = createCaptureAssetStore();
    const { assetId } = store.add(capture('s1'));
    const response = respondToAssetRequest(
      store,
      get(captureAssetUrl(assetId), 'POST'),
    );
    expect(response.status).toBe(405);
  });
});

describe('asset protocol registration', () => {
  it('registers a secure, fetchable, CORS-enabled standard scheme', () => {
    registerAssetScheme();
    expect(protocol.registerSchemesAsPrivileged).toHaveBeenCalledWith([
      {
        scheme: 'xshot-asset',
        privileges: {
          standard: true,
          secure: true,
          supportFetchAPI: true,
          stream: true,
          corsEnabled: true,
        },
      },
    ]);
  });

  it('serves the scheme from the given store', () => {
    const store = createCaptureAssetStore();
    const { assetId } = store.add(capture('s1'));
    handleAssetProtocol(store);
    const [scheme, handler] = (protocol.handle as jest.Mock).mock.calls[0];
    expect(scheme).toBe('xshot-asset');
    expect(handler(get(captureAssetUrl(assetId))).status).toBe(200);
  });
});

/**
 * @jest-environment node
 */
import type { WebContents } from 'electron';
import {
  guardWebContents,
  isAppPage,
  openExternalIfAllowed,
} from '../main/navigation-guards';

jest.mock('electron', () => ({
  app: { on: jest.fn() },
  shell: { openExternal: jest.fn(async () => undefined) },
}));
jest.mock('../main/logger', () => ({
  getLogger: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }),
}));

const APP_PAGE =
  'file:///Applications/X-Shot.app/Contents/Resources/app.asar/dist/renderer/index.html';

describe('isAppPage', () => {
  it.each([
    APP_PAGE,
    `${APP_PAGE}#/preferences`,
    `${APP_PAGE}?x=1#/screenshot`,
  ])('allows %s', (url) => {
    expect(isAppPage(url, APP_PAGE)).toBe(true);
  });

  it.each([
    'https://example.com/',
    'file:///etc/hosts',
    'file:///Applications/X-Shot.app/Contents/Resources/app.asar/dist/renderer/other.html',
    ['javascript', 'alert(1)'].join(':'),
    'not a url',
  ])('blocks %s', (url) => {
    expect(isAppPage(url, APP_PAGE)).toBe(false);
  });

  it('matches a page whose path needs escaping', () => {
    const page = 'file:///Users/me/My Apps/X-Shot/index.html';
    expect(
      isAppPage('file:///Users/me/My%20Apps/X-Shot/index.html#/', page),
    ).toBe(true);
  });

  it('allows the dev server page and nothing else on it', () => {
    const dev = 'http://localhost:1212/index.html';
    expect(
      isAppPage('http://localhost:1212/index.html#/preferences', dev),
    ).toBe(true);
    expect(isAppPage('http://localhost:1213/index.html', dev)).toBe(false);
  });
});

describe('openExternalIfAllowed', () => {
  it('opens only https links', () => {
    const open = jest.fn(async () => undefined);
    expect(openExternalIfAllowed('https://example.com/a', open)).toBe(true);
    expect(openExternalIfAllowed('http://example.com/a', open)).toBe(false);
    expect(openExternalIfAllowed('file:///etc/hosts', open)).toBe(false);
    expect(openExternalIfAllowed('smb://server/share', open)).toBe(false);
    expect(openExternalIfAllowed('nonsense', open)).toBe(false);
    expect(open.mock.calls).toEqual([['https://example.com/a']]);
  });
});

describe('guardWebContents', () => {
  type Handler = (event: { preventDefault: () => void }, url?: string) => void;

  function guarded() {
    const handlers = new Map<string, Handler>();
    let openHandler: (details: { url: string }) => { action: string } = () => ({
      action: 'allow',
    });
    const contents = {
      on: (event: string, handler: Handler) => handlers.set(event, handler),
      setWindowOpenHandler: (handler: typeof openHandler) => {
        openHandler = handler;
      },
    };
    guardWebContents(contents as unknown as WebContents, APP_PAGE);
    const navigate = (url: string) => {
      const event = { preventDefault: jest.fn() };
      handlers.get('will-navigate')?.(event, url);
      return event.preventDefault.mock.calls.length > 0;
    };
    return { handlers, navigate, open: (url: string) => openHandler({ url }) };
  }

  it('blocks navigation away from the app and allows its own routes', () => {
    const { navigate } = guarded();
    expect(navigate('https://example.com/')).toBe(true);
    expect(navigate('file:///etc/hosts')).toBe(true);
    expect(navigate(`${APP_PAGE}#/preferences`)).toBe(false);
  });

  it('denies every new window', () => {
    const { open } = guarded();
    expect(open('https://example.com/')).toEqual({ action: 'deny' });
    expect(open(`${APP_PAGE}#/preferences`)).toEqual({ action: 'deny' });
  });

  it('refuses webviews', () => {
    const { handlers } = guarded();
    const event = { preventDefault: jest.fn() };
    handlers.get('will-attach-webview')?.(event);
    expect(event.preventDefault).toHaveBeenCalled();
  });
});

import { app, shell, type WebContents } from 'electron';
import { getLogger } from './logger';
import { sanitizeLogMessage } from './log-sanitize';
import { resolveHtmlPath } from './util';

const logger = getLogger('security');

/** A page URL without its query and route, comparable across encodings. */
function pageOf(raw: string): string | null {
  try {
    const url = new URL(raw);
    const page = `${url.protocol}//${url.host}${decodeURI(url.pathname)}`;
    return process.platform === 'win32' ? page.toLowerCase() : page;
  } catch {
    return null;
  }
}

/** True when `target` is the app's own page, e.g. another of its routes. */
export function isAppPage(target: string, appPage: string): boolean {
  const page = pageOf(target);
  return page !== null && page === pageOf(appPage);
}

/** Only https links leave the app, and only in the default browser. */
export function openExternalIfAllowed(
  rawUrl: string,
  open: (url: string) => Promise<void> = shell.openExternal,
): boolean {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  open(url.toString()).catch((error) =>
    logger.warn('Failed to open external link', error),
  );
  return true;
}

/**
 * Keeps a web contents on the app's own page: navigating away is blocked,
 * new windows are refused (https links open in the browser instead) and
 * webviews cannot be attached.
 */
export function guardWebContents(contents: WebContents, appPage: string): void {
  contents.on('will-navigate', (event, url) => {
    if (isAppPage(url, appPage)) return;
    event.preventDefault();
    logger.warn('Blocked navigation away from the app', {
      url: sanitizeLogMessage(url),
    });
  });
  contents.on('will-attach-webview', (event) => event.preventDefault());
  contents.setWindowOpenHandler(({ url }) => {
    openExternalIfAllowed(url);
    return { action: 'deny' };
  });
}

/** Guards every web contents the app creates, including future windows. */
export default function installNavigationGuards(): void {
  const appPage = resolveHtmlPath('index.html');
  app.on('web-contents-created', (_event, contents) =>
    guardWebContents(contents, appPage),
  );
}

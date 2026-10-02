import { desktopCapturer, ipcMain, screen } from 'electron';
import type {
  BrowserWindow,
  DesktopCapturerSource,
  Display,
  NativeImage,
  Rectangle,
} from 'electron';
import log from 'electron-log';
import type {
  CaptureResult,
  IpcInvokes,
  ListCaptureSourcesResponse,
  ScreenshotResult,
} from '../../shared/ipc-types';
import {
  CaptureError,
  toCaptureFailure,
  toCaptureSuccess,
} from '../capture-result';
import { isScreenCaptureDenied } from '../screen-permission';
import {
  isScreenshotScreenRequest,
  isScreenshotSelection,
  isScreenshotWindowRequest,
  sanitizeCaptureType,
} from '../../shared/ipc-types';
import {
  closeScreenshotOverlays,
  createScreenshotOverlays,
  ensureMainWindowReady,
  getMainWindow,
  enableScreenSaverMode,
  hideWindowsForCapture,
  restoreWindowsAfterCapture,
} from '../windows';
import { updatePreferences } from '../preferences';
import {
  computeCropRect,
  displayForSelection,
  groupByPhysicalSize,
  physicalSize,
} from '../../shared/crop-geometry';
import {
  beginCaptureSession,
  endCaptureSession,
  markCaptureStage,
} from '../capture-diagnostics';
import {
  cancelCapture,
  configureCaptureCoordinator,
  confirmCapture,
  confirmSelection,
  isSessionCurrent,
  startCapture,
  type CancelReason,
  type CaptureCoordinatorHooks,
  type CaptureRect,
  type CaptureSessionRef,
} from '../capture-coordinator';

export default function registerScreenshotIpcHandlers() {
  type DisplaySnapshot = {
    image: NativeImage;
    dataUrl: string;
    width: number;
    height: number;
    bounds: Rectangle;
    scaleFactor: number;
    sourceId?: string;
  };
  // Snapshots live exactly as long as one capture session: taken when the
  // overlays open, released by the session observer when it ends.
  const displaySnapshots = new Map<number, DisplaySnapshot>();

  // Window sizes are unknown before capture; this bounds their thumbnails.
  const MAX_WINDOW_THUMBNAIL = 4096;

  const releaseDisplaySnapshots = () => {
    if (displaySnapshots.size === 0) return;
    log.info(
      `Releasing ${displaySnapshots.size} display snapshots from memory`,
    );
    displaySnapshots.clear();
  };

  /** The screen source of a display: by id, else the closest aspect ratio. */
  const pickSourceForDisplay = (
    sources: DesktopCapturerSource[],
    display: Display,
  ): DesktopCapturerSource | undefined => {
    const direct = sources.find((s) => s.display_id === String(display.id));
    if (direct || sources.length <= 1) return direct ?? sources[0];
    const target = physicalSize(display);
    const targetRatio = target.width / target.height;
    const ratioDelta = (s: DesktopCapturerSource) => {
      const size = s.thumbnail.getSize();
      return size.width > 0 && size.height > 0
        ? Math.abs(size.width / size.height - targetRatio)
        : Number.POSITIVE_INFINITY;
    };
    return sources.reduce((best, s) =>
      ratioDelta(s) < ratioDelta(best) ? s : best,
    );
  };

  /** Captures every display once, each at its native physical size. */
  const prepareDisplaySnapshots = async () => {
    releaseDisplaySnapshots();
    const displays = screen.getAllDisplays();
    try {
      // getSources scales every screen to one size per call, so displays
      // are captured in groups that share a physical size.
      await groupByPhysicalSize(displays).reduce(async (previous, group) => {
        await previous;
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: group.size,
        });
        group.displayIds.forEach((id) => {
          const display = displays.find((d) => d.id === id);
          const source = display && pickSourceForDisplay(sources, display);
          if (!display || !source) {
            log.warn(`Pre-capture: no screen source for display ${id}`);
            return;
          }
          const image = source.thumbnail;
          const size = image.getSize();
          displaySnapshots.set(id, {
            image,
            dataUrl: image.toDataURL(),
            width: size.width,
            height: size.height,
            bounds: display.bounds,
            scaleFactor: display.scaleFactor || 1,
            sourceId: source.id,
          });
          log.info(
            `Pre-capture: stored snapshot for display ${id} -> ${size.width}x${size.height}`,
          );
        });
      }, Promise.resolve());

      markCaptureStage('snapshot-ready', {
        displays: Array.from(displaySnapshots.entries()).map(
          ([displayId, snap]) => ({
            displayId,
            bounds: snap.bounds,
            scaleFactor: snap.scaleFactor,
            sourceId: snap.sourceId,
            frameWidth: snap.width,
            frameHeight: snap.height,
          }),
        ),
      });
    } catch (err) {
      log.error('Failed to prepare display snapshots:', err);
      releaseDisplaySnapshots();
    }
  };

  // The editor shows the failure but keeps whatever the user is editing.
  const sendCaptureFailure = async (
    session: CaptureSessionRef,
    error: unknown,
  ) => {
    const win = await ensureMainWindowReady();
    win.webContents.send('capture-result', toCaptureFailure(session.id, error));
  };

  const screenPermissionError = () =>
    new CaptureError('screen-permission', 'Screen Recording is denied.');

  const prepareSession = async (session: CaptureSessionRef) => {
    markCaptureStage('trigger', {
      platform: process.platform,
      source: session.source,
    });
    // With Screen Recording refused, overlays would only show a blank frozen
    // screen and the capture would fail; explain the problem at once.
    if (isScreenCaptureDenied()) {
      await sendCaptureFailure(session, screenPermissionError());
      throw screenPermissionError();
    }
    await hideWindowsForCapture();
    if (!isSessionCurrent(session)) return;
    await prepareDisplaySnapshots();
    if (!isSessionCurrent(session)) return;
    enableScreenSaverMode();
    await createScreenshotOverlays();
  };

  const cleanupSession = async (
    _session: CaptureSessionRef,
    reason: CancelReason,
  ) => {
    await closeScreenshotOverlays();
    releaseDisplaySnapshots();
    // Only restore the editor for user-visible cancellations; a replaced
    // session is immediately followed by a new one.
    if (reason !== 'replaced' && reason !== 'app-quit') {
      const main = getMainWindow();
      if (main && !main.isDestroyed()) main.show();
    }
  };

  const runDetached = (work: Promise<unknown>) => {
    work.catch((err) => log.error('Capture coordinator error:', err));
  };

  // Start screenshot capture (show overlays)
  ipcMain.on('screenshot-capture', () => {
    runDetached(startCapture('renderer'));
  });

  ipcMain.on('screenshot-cancel', () => {
    runDetached(cancelCapture('escape'));
  });

  ipcMain.handle(
    'list-capture-sources',
    async (
      _event,
      args?: IpcInvokes['list-capture-sources']['req'],
    ): Promise<IpcInvokes['list-capture-sources']['res']> => {
      try {
        const requestType = sanitizeCaptureType(args);
        const sources = await desktopCapturer.getSources({
          types: [requestType],
          thumbnailSize: { width: 1024, height: 1024 },
        });
        const response: ListCaptureSourcesResponse = sources.map((s) => ({
          id: s.id,
          name: s.name,
          appIcon: s.appIcon ? s.appIcon.toDataURL() : null,
          thumbnail: s.thumbnail
            ? s.thumbnail.resize({ width: 320 }).toDataURL()
            : null,
          displayId:
            (s as unknown as { display_id?: string }).display_id ?? null,
        }));
        return response;
      } catch (err) {
        log.error('Failed to list capture sources:', err);
        return [];
      }
    },
  );

  // Provide a snapshot for a given display to the overlay renderer
  ipcMain.handle('get-display-snapshot', async (_event, req: unknown) => {
    const { displayId } = (req as { displayId?: number | string }) || {};
    if (displayId === undefined || displayId === null) return null;
    const key = Number(displayId);
    let snap: DisplaySnapshot | undefined = displaySnapshots.get(key);
    if (!snap) {
      const d = screen.getAllDisplays().find((dd) => dd.id === key);
      if (d && displaySnapshots.size > 0) {
        const deviceScale = d.scaleFactor || 1;
        const targetW = Math.max(1, Math.floor(d.bounds.width * deviceScale));
        const targetH = Math.max(1, Math.floor(d.bounds.height * deviceScale));
        const targetRatio = targetW / targetH;
        let bestEntry: DisplaySnapshot | undefined;
        let bestDelta = Number.POSITIVE_INFINITY;
        displaySnapshots.forEach((value) => {
          const r =
            value.width > 0 && value.height > 0
              ? value.width / value.height
              : 0;
          const delta = Math.abs(r - targetRatio);
          if (delta < bestDelta) {
            bestDelta = delta;
            bestEntry = value;
          }
        });
        snap = bestEntry;
      }
    }
    if (!snap) return null;
    return { dataUrl: snap.dataUrl, width: snap.width, height: snap.height };
  });

  ipcMain.handle('release-display-snapshots', async () => {
    releaseDisplaySnapshots();
    return true;
  });

  const sendCaptureResult = (win: BrowserWindow, result: CaptureResult) => {
    win.webContents.send('capture-result', result);
  };

  const deliverWindowCapture = async (
    session: CaptureSessionRef,
    sourceId: string,
  ) => {
    await closeScreenshotOverlays();
    releaseDisplaySnapshots();
    await hideWindowsForCapture();
    if (!isSessionCurrent(session)) return;

    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: {
        width: MAX_WINDOW_THUMBNAIL,
        height: MAX_WINDOW_THUMBNAIL,
      },
    });
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      throw new CaptureError('source-unavailable', 'Window source not found');
    }
    const { thumbnail, name } = source;
    const size = thumbnail.getSize();
    const result = toCaptureSuccess({
      imageDataUrl: thumbnail.toDataURL(),
      width: size.width,
      height: size.height,
      sourceId: source.id,
      windowTitle: name,
      isWindowCapture: true,
      sessionId: session.id,
    } satisfies ScreenshotResult);
    const win = await ensureMainWindowReady();
    markCaptureStage('editor-sent', {
      captureKind: 'window',
      sourceId: source.id,
      outputWidth: size.width,
      outputHeight: size.height,
    });
    sendCaptureResult(win, result);
  };

  const deliverScreenCapture = async (
    session: CaptureSessionRef,
    request: { sourceId?: string; displayId?: number | string },
  ) => {
    await closeScreenshotOverlays();
    releaseDisplaySnapshots();
    await hideWindowsForCapture();
    if (!isSessionCurrent(session)) return;

    // Request the chosen display at its native size; without a known display
    // use the largest one so no screen is downscaled.
    const displays = screen.getAllDisplays();
    const chosen = displays.find(
      (d) => String(d.id) === String(request.displayId),
    );
    const sizes = (chosen ? [chosen] : displays).map(physicalSize);
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.max(...sizes.map((size) => size.width)),
        height: Math.max(...sizes.map((size) => size.height)),
      },
    });
    const source =
      sources.find((s) => s.id === request.sourceId) ??
      sources.find((s) => s.display_id === String(request.displayId)) ??
      sources[0];
    if (!source) {
      throw new CaptureError('source-unavailable', 'Screen source not found');
    }

    const { thumbnail } = source;
    const size = thumbnail.getSize();
    const result = toCaptureSuccess({
      imageDataUrl: thumbnail.toDataURL(),
      width: size.width,
      height: size.height,
      sourceId: source.id,
      displayId: source.display_id || null,
      isDisplayCapture: true,
      sessionId: session.id,
    } satisfies ScreenshotResult);
    const win = await ensureMainWindowReady();
    markCaptureStage('editor-sent', {
      captureKind: 'screen',
      sourceId: source.id,
      outputWidth: size.width,
      outputHeight: size.height,
    });
    sendCaptureResult(win, result);
  };

  const deliverSelectionCapture = async (
    session: CaptureSessionRef,
    data: CaptureRect,
  ) => {
    markCaptureStage('selection-confirmed');
    // Overlays must be gone before any post-selection acquisition so they
    // can never appear in the resulting pixels.
    await closeScreenshotOverlays();
    if (!isSessionCurrent(session)) return;

    // Capture from the display the selection was drawn on.
    const targetDisplay = displayForSelection(screen.getAllDisplays(), data);
    if (!targetDisplay) {
      throw new CaptureError('source-unavailable', 'No display found');
    }
    const { bounds, scaleFactor, id } = targetDisplay;
    // Refuse an empty area before touching any pixels.
    const displayGeometry = { ...physicalSize(targetDisplay), bounds };
    if (!computeCropRect(data, displayGeometry)) {
      throw new CaptureError('empty-selection', 'Empty selection');
    }

    // The frozen snapshot the user selected on; re-capture has none and
    // acquires the display live, once X-Shot's windows are hidden.
    let snapshot = displaySnapshots.get(id);
    if (!snapshot) {
      await hideWindowsForCapture();
      if (!isSessionCurrent(session)) return;
      const liveSources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: physicalSize(targetDisplay),
      });
      const match = pickSourceForDisplay(liveSources, targetDisplay);
      if (!match) {
        throw new CaptureError('source-unavailable', 'No screen source found');
      }
      const img = match.thumbnail;
      snapshot = {
        image: img,
        dataUrl: img.toDataURL(),
        width: img.getSize().width,
        height: img.getSize().height,
        bounds,
        scaleFactor: scaleFactor || 1,
        sourceId: match.id,
      };
    }

    const cropRect = computeCropRect(data, snapshot);
    if (!cropRect) throw new CaptureError('empty-selection', 'Empty selection');
    const croppedImage = snapshot.image.crop(cropRect);
    const result = toCaptureSuccess({
      imageDataUrl: croppedImage.toDataURL(),
      width: cropRect.width,
      height: cropRect.height,
      x: data.x,
      y: data.y,
      sourceId: String(id),
      displayId: id,
      sessionId: session.id,
    } satisfies ScreenshotResult);
    const win = await ensureMainWindowReady();

    // Persist last selection for quick re-capture
    try {
      await updatePreferences({
        capture: {
          lastSelection: {
            x: data.x,
            y: data.y,
            width: data.width,
            height: data.height,
            displayId: id,
          },
        } as any,
      });
    } catch {
      // noop
    }

    markCaptureStage('editor-sent', {
      captureKind: 'selection',
      displayId: id,
      displayBounds: bounds,
      scaleFactor,
      sourceId: snapshot.sourceId,
      frameWidth: snapshot.width,
      frameHeight: snapshot.height,
      cropRect,
      outputWidth: cropRect.width,
      outputHeight: cropRect.height,
    });
    sendCaptureResult(win, result);
    releaseDisplaySnapshots();
  };

  const commitSession: CaptureCoordinatorHooks['commit'] = async (
    session,
    payload,
  ) => {
    try {
      if (isScreenCaptureDenied()) throw screenPermissionError();
      if (payload.kind === 'window') {
        await deliverWindowCapture(session, payload.sourceId);
        return;
      }
      if (payload.kind === 'screen') {
        await deliverScreenCapture(session, payload);
        return;
      }
      await deliverSelectionCapture(session, payload.rect);
    } catch (error) {
      log.error('Error capturing screenshot:', error);
      releaseDisplaySnapshots();
      await sendCaptureFailure(session, error).catch((sendError) =>
        log.error('Failed to report capture failure:', sendError),
      );
      throw error;
    }
  };

  ipcMain.on('screenshot-window', (_event, payload: unknown) => {
    if (!isScreenshotWindowRequest(payload)) {
      log.warn('Invalid payload for screenshot-window');
      return;
    }
    runDetached(confirmCapture({ kind: 'window', sourceId: payload.sourceId }));
  });

  ipcMain.on('screenshot-screen', (_event, payload: unknown) => {
    if (!isScreenshotScreenRequest(payload)) {
      log.warn('Invalid payload for screenshot-screen');
      return;
    }
    runDetached(
      confirmCapture({
        kind: 'screen',
        sourceId: payload.sourceId,
        displayId: payload.displayId,
      }),
    );
  });

  ipcMain.on('screenshot-data', (_event, data: unknown) => {
    if (!isScreenshotSelection(data)) {
      log.warn('Invalid selection payload');
      return;
    }
    runDetached(confirmSelection(data));
  });

  configureCaptureCoordinator({
    hooks: {
      prepare: prepareSession,
      commit: commitSession,
      cleanup: cleanupSession,
    },
    observer: {
      onSessionStart: (session) =>
        beginCaptureSession(session.source, session.id),
      onSessionEnd: (_session, outcome) => {
        releaseDisplaySnapshots();
        restoreWindowsAfterCapture();
        endCaptureSession(outcome);
      },
    },
  });
}

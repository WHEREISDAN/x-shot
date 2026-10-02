import { desktopCapturer, ipcMain, screen } from 'electron';
import type { BrowserWindow, NativeImage } from 'electron';
import log from 'electron-log';
import type {
  CaptureResult,
  IpcInvokes,
  ListCaptureSourcesResponse,
  ScreenshotResult,
} from '../../shared/ipc-types';
import type { CaptureAssetRef } from '../../shared/capture-asset';
import { isCaptureAssetId } from '../../shared/capture-asset';
import { captureAssets } from '../capture-assets';
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
import measureWindowSource, {
  windowThumbnailSize,
} from '../window-source-size';
import {
  computeCropRect,
  displayForSelection,
  physicalSize,
} from '../../shared/crop-geometry';
import {
  beginCaptureSession,
  endCaptureSession,
  markCaptureStage,
} from '../capture-diagnostics';
import {
  getDisplaySnapshot,
  overlaySnapshotFor,
  pickSourceForDisplay,
  prepareDisplaySnapshots,
  releaseDisplaySnapshots,
  type DisplaySnapshot,
} from '../display-snapshots';
import {
  cancelCapture,
  configureCaptureCoordinator,
  confirmCapture,
  confirmSelection,
  getActiveSession,
  isSessionCurrent,
  startCapture,
  type CancelReason,
  type CaptureCoordinatorHooks,
  type CaptureRect,
  type CaptureSessionRef,
} from '../capture-coordinator';

/** Pixels a selection is cropped from: a frozen snapshot or a live capture. */
type CropSource = Omit<DisplaySnapshot, 'assetId'>;

export default function registerScreenshotIpcHandlers() {
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
    await prepareDisplaySnapshots(session.id);
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
        // Previews belong to the capture session whose overlay shows them.
        const session = getActiveSession();
        if (!session) return [];
        const requestType = sanitizeCaptureType(args);
        const sources = await desktopCapturer.getSources({
          types: [requestType],
          thumbnailSize: { width: 1024, height: 1024 },
        });
        const preview = (image: NativeImage | null | undefined) => {
          if (!image || image.isEmpty()) return null;
          const { width, height } = image.getSize();
          return captureAssets.add({
            sessionId: session.id,
            kind: 'preview',
            width,
            height,
            scaleFactor: 1,
            encode: () => image.toPNG(),
          }).assetId;
        };
        const response: ListCaptureSourcesResponse = sources.map((s) => ({
          id: s.id,
          name: s.name,
          appIconAssetId: preview(s.appIcon),
          thumbnailAssetId: preview(s.thumbnail?.resize({ width: 320 })),
          displayId: s.display_id ?? null,
        }));
        return response;
      } catch (err) {
        log.error('Failed to list capture sources:', err);
        return [];
      }
    },
  );

  // The overlay's frozen background, served through the asset protocol.
  ipcMain.handle(
    'get-display-snapshot',
    async (
      _event,
      req: unknown,
    ): Promise<IpcInvokes['get-display-snapshot']['res']> => {
      const { displayId } = (req as { displayId?: number | string }) || {};
      const key = Number(displayId);
      if (displayId === undefined || !Number.isFinite(key)) return null;
      return overlaySnapshotFor(key);
    },
  );

  // The editor discarded its capture.
  ipcMain.handle('release-capture-asset', async (_event, req: unknown) => {
    const { assetId } = (req as { assetId?: unknown }) || {};
    return isCaptureAssetId(assetId) && captureAssets.release(assetId);
  });

  /** Keeps the capture in main; the editor gets only its id and size. */
  const storeCapture = (
    session: CaptureSessionRef,
    image: NativeImage,
    scaleFactor: number,
  ): CaptureAssetRef => {
    if (image.isEmpty()) throw new Error('The captured image is empty.');
    const { width, height } = image.getSize();
    const png = image.toPNG();
    const asset = captureAssets.add({
      sessionId: session.id,
      kind: 'capture',
      width,
      height,
      scaleFactor,
      encode: () => png,
    });
    return { assetId: asset.assetId, width, height, scaleFactor };
  };

  // The editor shows one capture at a time, so a delivered capture releases
  // the one it replaces.
  const sendCaptureResult = (
    win: BrowserWindow,
    session: CaptureSessionRef,
    result: CaptureResult,
  ) => {
    win.webContents.send('capture-result', result);
    captureAssets.releaseWhere((asset) => asset.sessionId !== session.id);
  };

  const scaleFactorOf = (displayId: string | number | undefined) =>
    (
      screen.getAllDisplays().find((d) => String(d.id) === String(displayId)) ??
      screen.getPrimaryDisplay()
    ).scaleFactor;

  const deliverWindowCapture = async (
    session: CaptureSessionRef,
    sourceId: string,
  ) => {
    await closeScreenshotOverlays();
    releaseDisplaySnapshots();
    await hideWindowsForCapture();
    if (!isSessionCurrent(session)) return;

    // Thumbnails are scaled to fill the requested box, so the window is
    // requested at its measured native size.
    const editor = await ensureMainWindowReady();
    const measureStart = Date.now();
    const nativeSize = await measureWindowSource(editor.webContents, sourceId);
    if (!isSessionCurrent(session)) return;
    markCaptureStage('window-measured', {
      sourceId,
      nativeSize,
      durationMs: Date.now() - measureStart,
    });
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: windowThumbnailSize(nativeSize),
    });
    const source = sources.find((s) => s.id === sourceId);
    if (!source) {
      throw new CaptureError('source-unavailable', 'Window source not found');
    }
    const { thumbnail, name } = source;
    // desktopCapturer does not report a window's display, so the primary
    // display's scale is the best estimate.
    const asset = storeCapture(
      session,
      thumbnail,
      screen.getPrimaryDisplay().scaleFactor,
    );
    const result = toCaptureSuccess({
      ...asset,
      sourceId: source.id,
      windowTitle: name,
      isWindowCapture: true,
      sessionId: session.id,
    } satisfies ScreenshotResult);
    const win = await ensureMainWindowReady();
    markCaptureStage('editor-sent', {
      captureKind: 'window',
      sourceId: source.id,
      outputWidth: asset.width,
      outputHeight: asset.height,
    });
    sendCaptureResult(win, session, result);
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

    const asset = storeCapture(
      session,
      source.thumbnail,
      scaleFactorOf(source.display_id || request.displayId),
    );
    const result = toCaptureSuccess({
      ...asset,
      sourceId: source.id,
      displayId: source.display_id || null,
      isDisplayCapture: true,
      sessionId: session.id,
    } satisfies ScreenshotResult);
    const win = await ensureMainWindowReady();
    markCaptureStage('editor-sent', {
      captureKind: 'screen',
      sourceId: source.id,
      outputWidth: asset.width,
      outputHeight: asset.height,
    });
    sendCaptureResult(win, session, result);
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
    let snapshot: CropSource | undefined = getDisplaySnapshot(id);
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
        width: img.getSize().width,
        height: img.getSize().height,
        bounds,
        scaleFactor: scaleFactor || 1,
        sourceId: match.id,
      };
    }

    const cropRect = computeCropRect(data, snapshot);
    if (!cropRect) throw new CaptureError('empty-selection', 'Empty selection');
    const asset = storeCapture(
      session,
      snapshot.image.crop(cropRect),
      snapshot.scaleFactor,
    );
    const result = toCaptureSuccess({
      ...asset,
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
      outputWidth: asset.width,
      outputHeight: asset.height,
    });
    sendCaptureResult(win, session, result);
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
      captureAssets.releaseWhere((asset) => asset.sessionId === session.id);
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
      onSessionEnd: (session, outcome) => {
        releaseDisplaySnapshots();
        // Overlay images go with the session; a capture only if it was
        // never delivered.
        captureAssets.releaseWhere(
          (asset) =>
            asset.sessionId === session.id &&
            (asset.kind !== 'capture' || outcome !== 'completed'),
        );
        restoreWindowsAfterCapture();
        endCaptureSession(outcome);
      },
    },
  });
}

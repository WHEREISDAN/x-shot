import { desktopCapturer, ipcMain } from 'electron';
import type { NativeImage } from 'electron';
import log from 'electron-log';
import type {
  IpcInvokes,
  ListCaptureSourcesResponse,
} from '../../shared/ipc-types';
import { isCaptureAssetId } from '../../shared/capture-asset';
import { captureAssets } from '../capture-assets';
import { CaptureError, toCaptureFailure } from '../capture-result';
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
import {
  beginCaptureSession,
  endCaptureSession,
  markCaptureStage,
} from '../capture-diagnostics';
import {
  overlaySnapshotFor,
  prepareDisplaySnapshots,
  releaseDisplaySnapshots,
} from '../display-snapshots';
import {
  deliverScreenCapture,
  deliverSelectionCapture,
  deliverWindowCapture,
} from '../capture-delivery';
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
  type CaptureSessionRef,
} from '../capture-coordinator';

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

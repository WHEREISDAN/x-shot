import { desktopCapturer, ipcMain, screen } from 'electron';
import type { NativeImage, Rectangle } from 'electron';
import log from 'electron-log';
import type {
  IpcInvokes,
  ListCaptureSourcesResponse,
  ScreenshotResult,
} from '../../shared/ipc-types';
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
} from '../windows';
import { updatePreferences } from '../preferences';
import { computeCropRect } from '../../shared/crop-geometry';
import {
  beginCaptureSession,
  endCaptureSession,
  getActiveCaptureSessionId,
  markCaptureStage,
} from '../capture-diagnostics';

export default function registerScreenshotIpcHandlers() {
  type DisplaySnapshot = {
    image: NativeImage;
    dataUrl: string;
    width: number;
    height: number;
    bounds: Rectangle;
    scaleFactor: number;
    timestamp: number;
    sourceId?: string;
  };
  const displaySnapshots = new Map<number, DisplaySnapshot>();

  // Memory management constants
  const MAX_SNAPSHOT_AGE_MS = 30000;
  const MAX_SNAPSHOT_DIMENSION = 4096;
  let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

  const releaseDisplaySnapshots = () => {
    log.info(
      `Releasing ${displaySnapshots.size} display snapshots from memory`,
    );
    displaySnapshots.clear();
    if (cleanupTimer) {
      clearTimeout(cleanupTimer);
      cleanupTimer = null;
    }
  };

  const cleanupExpiredSnapshots = () => {
    const now = Date.now();
    let cleanedCount = 0;
    const expiredKeys: number[] = [];

    displaySnapshots.forEach((snapshot, key) => {
      if (now - snapshot.timestamp > MAX_SNAPSHOT_AGE_MS) {
        expiredKeys.push(key);
      }
    });

    expiredKeys.forEach((key) => {
      displaySnapshots.delete(key);
      cleanedCount += 1;
    });

    if (cleanedCount > 0) {
      log.info(`Cleaned up ${cleanedCount} expired display snapshots`);
    }
  };

  const scheduleCleanup = () => {
    if (cleanupTimer) clearTimeout(cleanupTimer);
    cleanupTimer = setTimeout(() => {
      cleanupExpiredSnapshots();
      if (displaySnapshots.size > 0) {
        scheduleCleanup();
      }
    }, MAX_SNAPSHOT_AGE_MS);
  };

  const prepareDisplaySnapshots = async () => {
    releaseDisplaySnapshots();
    const displays = screen.getAllDisplays();
    const timestamp = Date.now();

    try {
      // Capture all screens with reduced max resolution for memory efficiency
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: MAX_SNAPSHOT_DIMENSION,
          height: MAX_SNAPSHOT_DIMENSION,
        },
      });

      log.info(
        `Pre-capture: found ${displays.length} displays and ${sources.length} screen sources`,
      );

      let totalMemoryMB = 0;
      const pickBestSourceForDisplay = (
        display: (typeof displays)[number],
        index: number,
      ) => {
        const direct = sources.find(
          (s) =>
            (s as unknown as { display_id?: string }).display_id ===
            String(display.id),
        );
        if (direct) return direct;
        if (sources.length === 1) return sources[0];
        const deviceScale = display.scaleFactor || 1;
        const targetW = Math.max(
          1,
          Math.floor(display.bounds.width * deviceScale),
        );
        const targetH = Math.max(
          1,
          Math.floor(display.bounds.height * deviceScale),
        );
        const targetRatio = targetW / targetH;
        let best = sources[0];
        let bestDelta = Number.POSITIVE_INFINITY;
        for (let idx = 0; idx < sources.length; idx += 1) {
          const candidate = sources[idx];
          const sz = candidate.thumbnail.getSize();
          if (sz.width > 0 && sz.height > 0) {
            const r = sz.width / sz.height;
            const delta = Math.abs(r - targetRatio);
            if (delta < bestDelta) {
              best = candidate;
              bestDelta = delta;
            }
          }
        }
        return best ?? sources[Math.min(index, sources.length - 1)];
      };

      displays.forEach((d, i) => {
        const { bounds, scaleFactor, id } = d;
        const source = pickBestSourceForDisplay(d, i);
        if (!source) {
          log.warn(
            `Pre-capture: no source matched for display ${id} (index ${i})`,
          );
          return;
        }

        const img = source.thumbnail;
        const size = img.getSize();
        const memoryUsageMB = (size.width * size.height * 4) / (1024 * 1024);
        totalMemoryMB += memoryUsageMB;

        displaySnapshots.set(id, {
          image: img,
          dataUrl: img.toDataURL(),
          width: size.width,
          height: size.height,
          bounds,
          scaleFactor: scaleFactor || 1,
          timestamp,
          sourceId: source.id,
        });
        log.info(
          `Pre-capture: stored snapshot for display ${id} -> ${size.width}x${size.height}`,
        );
      });

      log.info(
        `Prepared ${displaySnapshots.size} display snapshots (${Math.round(totalMemoryMB)}MB total)`,
      );
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
      scheduleCleanup();
    } catch (err) {
      log.error('Failed to prepare display snapshots:', err);
      releaseDisplaySnapshots();
    }
  };

  // Start screenshot capture (show overlays)
  ipcMain.on('screenshot-capture', async () => {
    beginCaptureSession('capture');
    markCaptureStage('trigger', { platform: process.platform });
    const main = getMainWindow();
    if (main) main.hide();
    await prepareDisplaySnapshots();
    enableScreenSaverMode();
    await createScreenshotOverlays();
  });

  ipcMain.on('screenshot-cancel', () => {
    endCaptureSession('canceled');
    closeScreenshotOverlays();
    releaseDisplaySnapshots();
    const main = getMainWindow();
    if (main) main.show();
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

  ipcMain.on('screenshot-window', async (_event, payload: unknown) => {
    closeScreenshotOverlays();
    releaseDisplaySnapshots();
    try {
      if (!isScreenshotWindowRequest(payload)) {
        throw new Error('Invalid payload for screenshot-window');
      }
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: {
          width: MAX_SNAPSHOT_DIMENSION,
          height: MAX_SNAPSHOT_DIMENSION,
        },
      });
      const source = sources.find((s) => s.id === payload.sourceId);
      if (!source) throw new Error('Window source not found');
      const { thumbnail, name } = source;
      const size = thumbnail.getSize();
      const imageDataUrl = thumbnail.toDataURL();
      const win = await ensureMainWindowReady();
      const screenshotData: ScreenshotResult = {
        imageDataUrl,
        width: size.width,
        height: size.height,
        sourceId: source.id,
        windowTitle: name,
        isWindowCapture: true,
      };
      win.webContents.send('screenshot-data', screenshotData);
    } catch (error) {
      log.error('Error capturing window source:', error);
      const main = getMainWindow();
      if (main) {
        main.show();
        main.focus();
      }
    }
  });

  ipcMain.on('screenshot-screen', async (_event, payload: unknown) => {
    closeScreenshotOverlays();
    releaseDisplaySnapshots();
    try {
      if (!isScreenshotScreenRequest(payload)) {
        throw new Error('Invalid payload for screenshot-screen');
      }
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: {
          width: MAX_SNAPSHOT_DIMENSION,
          height: MAX_SNAPSHOT_DIMENSION,
        },
      });
      let source = sources.find((s) => s.id === payload.sourceId);
      if (!source && payload.displayId !== undefined) {
        source = sources.find(
          (s) =>
            (s as unknown as { display_id?: string }).display_id ===
            String(payload.displayId),
        );
      }
      if (!source) [source] = sources;
      if (!source) throw new Error('Screen source not found');

      const { thumbnail } = source;
      const size = thumbnail.getSize();
      const imageDataUrl = thumbnail.toDataURL();

      const win = await ensureMainWindowReady();
      const screenshotData: ScreenshotResult = {
        imageDataUrl,
        width: size.width,
        height: size.height,
        sourceId: source.id,
        displayId:
          (source as unknown as { display_id?: string }).display_id ?? null,
        isDisplayCapture: true,
      };
      win.webContents.send('screenshot-data', screenshotData);
    } catch (error) {
      log.error('Error capturing screen source:', error);
      const main = getMainWindow();
      if (main) {
        main.show();
        main.focus();
      }
    }
  });

  ipcMain.on('screenshot-data', async (_event, data: unknown) => {
    markCaptureStage('selection-confirmed');
    closeScreenshotOverlays();
    try {
      if (!isScreenshotSelection(data)) {
        throw new Error('Invalid selection payload');
      }
      const selectionRect = {
        x: Math.round(data.x),
        y: Math.round(data.y),
        width: Math.round(data.width),
        height: Math.round(data.height),
      };
      const targetDisplay = screen.getDisplayMatching(selectionRect);
      const { bounds, scaleFactor, id } = targetDisplay;
      const deviceScale = scaleFactor || 1;

      // Prefer pre-captured snapshot for the matched display
      let snapshot = displaySnapshots.get(id);
      if (!snapshot) {
        // Fallback: capture current screen if snapshot is missing
        const fallbackSources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: {
            width: Math.max(1, Math.floor(bounds.width * deviceScale)),
            height: Math.max(1, Math.floor(bounds.height * deviceScale)),
          },
        });
        const match = fallbackSources.find((s) => s.display_id === String(id));
        if (!match) throw new Error('No screen source found');
        const img = match.thumbnail;
        snapshot = {
          image: img,
          dataUrl: img.toDataURL(),
          width: img.getSize().width,
          height: img.getSize().height,
          bounds,
          scaleFactor: deviceScale,
          timestamp: Date.now(),
        };
      }

      if (!snapshot) {
        throw new Error('No display snapshot available');
      }

      const cropRect = computeCropRect(data, bounds, {
        width: snapshot.width,
        height: snapshot.height,
        bounds: snapshot.bounds,
      });
      const croppedImage = snapshot.image.crop(cropRect);

      const imageDataUrl = croppedImage.toDataURL();
      const win = await ensureMainWindowReady();
      const screenshotData: ScreenshotResult = {
        imageDataUrl,
        width: cropRect.width,
        height: cropRect.height,
        x: data.x,
        y: data.y,
        sourceId: String(id),
        displayId: id,
        sessionId: getActiveCaptureSessionId() ?? undefined,
      };
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
      win.webContents.send('screenshot-data', screenshotData);
      releaseDisplaySnapshots();
      endCaptureSession('completed');
    } catch (error) {
      endCaptureSession('error');
      log.error('Error capturing screenshot:', error);
      const win = await ensureMainWindowReady();
      const fallbackData = isScreenshotSelection(data)
        ? data
        : { x: 0, y: 0, width: 0, height: 0 };
      const fallback: ScreenshotResult = {
        imageDataUrl: '',
        width: fallbackData.width,
        height: fallbackData.height,
        x: fallbackData.x,
        y: fallbackData.y,
      };
      win.webContents.send('screenshot-data', fallback);
    }
  });
}

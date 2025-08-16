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

export default function registerScreenshotIpcHandlers() {
  // In-memory store of pre-captured display images for the current screenshot session
  const displaySnapshots = new Map<
    number,
    {
      image: NativeImage;
      dataUrl: string;
      width: number;
      height: number;
      bounds: Rectangle;
      scaleFactor: number;
    }
  >();

  const releaseDisplaySnapshots = () => {
    displaySnapshots.clear();
  };

  const prepareDisplaySnapshots = async () => {
    releaseDisplaySnapshots();
    const displays = screen.getAllDisplays();
    try {
      // Capture all screens at native resolution (clamped for safety)
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 8192, height: 8192 },
      });
      displays.forEach((d) => {
        const { bounds, scaleFactor, id } = d;
        const source = sources.find((s) => s.display_id === String(id));
        if (!source) {
          return;
        }
        const img = source.thumbnail;
        const size = img.getSize();
        displaySnapshots.set(id, {
          image: img,
          dataUrl: img.toDataURL(),
          width: size.width,
          height: size.height,
          bounds,
          scaleFactor: scaleFactor || 1,
        });
      });
    } catch (err) {
      log.error('Failed to prepare display snapshots:', err);
      releaseDisplaySnapshots();
    }
  };

  // Start screenshot capture (show overlays)
  ipcMain.on('screenshot-capture', async () => {
    const main = getMainWindow();
    if (main) main.hide();
    await prepareDisplaySnapshots();
    enableScreenSaverMode();
    await createScreenshotOverlays();
  });

  ipcMain.on('screenshot-cancel', () => {
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
    const snap = displaySnapshots.get(key);
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
        thumbnailSize: { width: 8192, height: 8192 },
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
        thumbnailSize: { width: 8192, height: 8192 },
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
        };
      }

      const scaleX = snapshot.width / Math.max(1, snapshot.bounds.width);
      const scaleY = snapshot.height / Math.max(1, snapshot.bounds.height);
      const cropX = Math.max(0, Math.round((data.x - bounds.x) * scaleX));
      const cropY = Math.max(0, Math.round((data.y - bounds.y) * scaleY));
      const cropWidth = Math.round(data.width * scaleX);
      const cropHeight = Math.round(data.height * scaleY);
      const snapSize = snapshot.image.getSize();
      const finalWidth = Math.min(cropWidth, snapSize.width - cropX);
      const finalHeight = Math.min(cropHeight, snapSize.height - cropY);

      const croppedImage = snapshot.image.crop({
        x: cropX,
        y: cropY,
        width: finalWidth,
        height: finalHeight,
      });

      const imageDataUrl = croppedImage.toDataURL();
      const win = await ensureMainWindowReady();
      const screenshotData: ScreenshotResult = {
        imageDataUrl,
        width: finalWidth,
        height: finalHeight,
        x: data.x,
        y: data.y,
        sourceId: String(id),
        displayId: id,
      };
      win.webContents.send('screenshot-data', screenshotData);
      releaseDisplaySnapshots();
    } catch (error) {
      log.error('Error capturing screenshot:', error);
      const win = await ensureMainWindowReady();
      const fallback: ScreenshotResult = {
        imageDataUrl: '',
        width: (data as { width: number }).width,
        height: (data as { height: number }).height,
        x: (data as { x: number }).x,
        y: (data as { y: number }).y,
      };
      win.webContents.send('screenshot-data', fallback);
    }
  });
}

import path from 'path';
import { app, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import log from 'electron-log';
import type {
  CopyImageRequest,
  SaveImageRequest,
  SaveImageResponse,
} from '../../shared/ipc-types';

export default function registerFileIpcHandlers() {
  ipcMain.handle(
    'copy-image',
    async (_event, payload: CopyImageRequest): Promise<boolean> => {
      try {
        const image = nativeImage.createFromDataURL(payload.dataUrl);
        if (image.isEmpty()) return false;
        clipboard.writeImage(image);
        return true;
      } catch (err) {
        log.error('Failed to copy image:', err);
        return false;
      }
    },
  );

  ipcMain.handle(
    'save-image',
    async (_event, payload: SaveImageRequest): Promise<SaveImageResponse> => {
      try {
        const image = nativeImage.createFromDataURL(payload.dataUrl);
        if (image.isEmpty()) {
          return { filePath: null, canceled: true };
        }

        const defaultDir = app.getPath('pictures');
        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .replace('T', '_')
          .slice(0, 19);
        const defaultName = `X-Shot_${timestamp}.png`;

        const result = await dialog.showSaveDialog({
          defaultPath:
            payload.defaultPath ?? path.join(defaultDir, defaultName),
          filters: [
            { name: 'PNG Image', extensions: ['png'] },
            { name: 'All Files', extensions: ['*'] },
          ],
        });

        if (result.canceled || !result.filePath) {
          return { filePath: null, canceled: true };
        }

        const buffer = image.toPNG();
        const fs = await import('fs/promises');
        await fs.writeFile(result.filePath, buffer);
        return { filePath: result.filePath, canceled: false };
      } catch (err) {
        log.error('Failed to save image:', err);
        return { filePath: null, canceled: true };
      }
    },
  );
}

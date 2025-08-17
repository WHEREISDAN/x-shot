import path from 'path';
import { app, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import log from 'electron-log';
import type {
  CopyImageRequest,
  SaveImageRequest,
  SaveImageResponse,
} from '../../shared/ipc-types';
import { loadPreferences } from '../preferences';

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

        // Load preferences to get save location and format
        const preferences = await loadPreferences();
        const defaultDir =
          preferences.capture.defaultSaveLocation || app.getPath('pictures');
        const format = preferences.capture.defaultFormat || 'png';

        const timestamp = new Date()
          .toISOString()
          .replace(/[:.]/g, '-')
          .replace('T', '_')
          .slice(0, 19);

        // Generate filename using pattern from preferences
        const filenamePattern =
          preferences.export.filenamePattern || 'X-Shot_$TIMESTAMP';
        const filename = filenamePattern
          .replace('$TIMESTAMP', timestamp)
          .replace('$DATE', new Date().toISOString().slice(0, 10))
          .replace(
            '$TIME',
            new Date().toTimeString().slice(0, 8).replace(/:/g, '-'),
          );

        const defaultName = `${filename}.${format}`;

        // Check if auto-save is enabled
        if (preferences.export.autoSave && !payload.defaultPath) {
          // Auto-save without dialog
          const filePath = path.join(defaultDir, defaultName);
          const buffer = format === 'png' ? image.toPNG() : image.toJPEG(90);
          const fs = await import('fs/promises');
          await fs.writeFile(filePath, buffer);
          return { filePath, canceled: false };
        }

        // Show save dialog
        const filters =
          format === 'png'
            ? [
                { name: 'PNG Image', extensions: ['png'] },
                { name: 'JPG Image', extensions: ['jpg', 'jpeg'] },
                { name: 'All Files', extensions: ['*'] },
              ]
            : [
                { name: 'JPG Image', extensions: ['jpg', 'jpeg'] },
                { name: 'PNG Image', extensions: ['png'] },
                { name: 'All Files', extensions: ['*'] },
              ];

        const result = await dialog.showSaveDialog({
          defaultPath:
            payload.defaultPath ?? path.join(defaultDir, defaultName),
          filters,
        });

        if (result.canceled || !result.filePath) {
          return { filePath: null, canceled: true };
        }

        // Determine format from file extension if available, or use preference
        const fileExtension = path.extname(result.filePath).toLowerCase();
        let useFormat = format;
        if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
          useFormat = 'jpg';
        } else if (fileExtension === '.png') {
          useFormat = 'png';
        }

        const buffer = useFormat === 'png' ? image.toPNG() : image.toJPEG(90);
        const fs = await import('fs/promises');
        await fs.writeFile(result.filePath, buffer);
        return { filePath: result.filePath, canceled: false };
      } catch (err) {
        log.error('Failed to save image:', err);
        return { filePath: null, canceled: true };
      }
    },
  );

  ipcMain.handle(
    'select-folder',
    async (
      _event,
      payload: { defaultPath?: string },
    ): Promise<{ filePath: string | null; canceled: boolean }> => {
      try {
        const result = await dialog.showOpenDialog({
          defaultPath: payload.defaultPath,
          properties: ['openDirectory'],
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { filePath: null, canceled: true };
        }

        return { filePath: result.filePaths[0], canceled: false };
      } catch (err) {
        log.error('Failed to select folder:', err);
        return { filePath: null, canceled: true };
      }
    },
  );
}

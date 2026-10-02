import fs from 'fs/promises';
import path from 'path';
import { app, clipboard, dialog, ipcMain, nativeImage } from 'electron';
import type { NativeImage } from 'electron';
import type {
  CopyImageRequest,
  CopyImageResponse,
  SaveImageRequest,
  SaveImageResponse,
} from '../../shared/ipc-types';
import { formatFilename, numberedFilename } from '../../shared/export-filename';
import { loadPreferences, sanitizeFilenamePattern } from '../preferences';
import { getLogger } from '../logger';

const log = getLogger('files');

const MAX_DATA_URL_LENGTH = 80 * 1024 * 1024;
const MAX_NAME_ATTEMPTS = 1000;
const UNSUPPORTED_IMAGE = 'The image is not a PNG or JPEG data URL.';
const EMPTY_IMAGE = 'The image is empty.';

function isSupportedImageDataUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_DATA_URL_LENGTH &&
    /^data:image\/(?:png|jpe?g);base64,/i.test(value)
  );
}

function dataUrlOf(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const { dataUrl } = payload as { dataUrl?: unknown };
  return isSupportedImageDataUrl(dataUrl) ? dataUrl : null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function encode(image: NativeImage, format: 'png' | 'jpg'): Buffer {
  return format === 'png' ? image.toPNG() : image.toJPEG(90);
}

/**
 * Writes `data` under the first free name: "name.png", "name (2).png", ...
 * The exclusive 'wx' flag means an existing file is never overwritten, even
 * if another save creates the same name at the same moment.
 */
async function writeWithoutOverwrite(
  dir: string,
  base: string,
  extension: string,
  data: Buffer,
  attempt = 1,
): Promise<string> {
  if (attempt > MAX_NAME_ATTEMPTS) {
    throw new Error(`No free file name for ${base}${extension} in ${dir}`);
  }
  const filePath = path.join(dir, numberedFilename(base, extension, attempt));
  try {
    await fs.writeFile(filePath, data, { flag: 'wx' });
    return filePath;
  } catch (error) {
    if ((error as { code?: string }).code !== 'EEXIST') throw error;
    return writeWithoutOverwrite(dir, base, extension, data, attempt + 1);
  }
}

function formatForPath(filePath: string, fallback: 'png' | 'jpg') {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === '.jpg' || extension === '.jpeg') return 'jpg';
  if (extension === '.png') return 'png';
  return fallback;
}

export default function registerFileIpcHandlers() {
  ipcMain.handle(
    'copy-image',
    async (
      _event,
      payload: CopyImageRequest | unknown,
    ): Promise<CopyImageResponse> => {
      const startTime = performance.now();
      const dataUrl = dataUrlOf(payload);
      if (!dataUrl) return { ok: false, error: UNSUPPORTED_IMAGE };
      try {
        const image = nativeImage.createFromDataURL(dataUrl);
        if (image.isEmpty()) return { ok: false, error: EMPTY_IMAGE };
        clipboard.writeImage(image);
        log.info('export-copy', {
          op: 'copy-image',
          durationMs: Math.round(performance.now() - startTime),
          dataUrlChars: dataUrl.length,
        });
        return { ok: true };
      } catch (error) {
        log.error('Failed to copy image:', error);
        return { ok: false, error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'save-image',
    async (
      _event,
      payload: SaveImageRequest | unknown,
    ): Promise<SaveImageResponse> => {
      const startTime = performance.now();
      const logSave = (outcome: string, dataUrlChars: number) => {
        log.info('export-save', {
          op: 'save-image',
          outcome,
          durationMs: Math.round(performance.now() - startTime),
          dataUrlChars,
        });
      };
      const dataUrl = dataUrlOf(payload);
      if (!dataUrl) return { status: 'failed', error: UNSUPPORTED_IMAGE };
      const request = payload as SaveImageRequest;

      try {
        const image = nativeImage.createFromDataURL(dataUrl);
        if (image.isEmpty()) return { status: 'failed', error: EMPTY_IMAGE };

        const preferences = await loadPreferences();
        const saveDir =
          preferences.capture.defaultSaveLocation || app.getPath('pictures');
        const format = preferences.capture.defaultFormat || 'png';
        const base = formatFilename(
          sanitizeFilenamePattern(preferences.export.filenamePattern),
          new Date(),
        );
        const extension = `.${format}`;

        if (preferences.export.autoSave && !request.defaultPath) {
          await fs.mkdir(saveDir, { recursive: true });
          const filePath = await writeWithoutOverwrite(
            saveDir,
            base,
            extension,
            encode(image, format),
          );
          logSave('auto-saved', dataUrl.length);
          return { status: 'saved', filePath };
        }

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
            request.defaultPath ?? path.join(saveDir, `${base}${extension}`),
          filters,
        });
        if (result.canceled || !result.filePath) return { status: 'canceled' };

        // The save dialog already asked before replacing an existing file.
        await fs.writeFile(
          result.filePath,
          encode(image, formatForPath(result.filePath, format)),
        );
        logSave('saved', dataUrl.length);
        return { status: 'saved', filePath: result.filePath };
      } catch (error) {
        log.error('Failed to save image:', error);
        logSave('failed', dataUrl.length);
        return { status: 'failed', error: errorMessage(error) };
      }
    },
  );

  ipcMain.handle(
    'select-folder',
    async (
      _event,
      payload: { defaultPath?: string } | unknown,
    ): Promise<{ filePath: string | null; canceled: boolean }> => {
      try {
        const result = await dialog.showOpenDialog({
          defaultPath:
            typeof payload === 'object' && payload !== null
              ? (payload as { defaultPath?: string }).defaultPath
              : undefined,
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

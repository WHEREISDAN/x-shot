import type { BackgroundImageRef } from '../shared/preferences-types';
import { isPlainObject } from './preferences-schema';

type PlainRecord = Record<string, unknown>;

export interface MigrationResult {
  /** The stored preferences in the current shape. */
  value: PlainRecord;
  /** What changed, for the log; empty when nothing did. */
  changes: string[];
}

/** Stores image bytes as a background file; null if they are no image. */
export type SaveBackground = (
  bytes: Buffer,
) => Promise<BackgroundImageRef | null>;

const DATA_URL = /^data:image\/[\w.+-]+;base64,/i;
const BUNDLED_FILE = /^[\w-]{1,128}\.(?:png|jpe?g|gif|webp)$/i;

/** presentation.exportScale became the single export.defaultScale. */
function migrateExportScale(value: PlainRecord, changes: string[]): void {
  const presentation = isPlainObject(value.presentation)
    ? value.presentation
    : null;
  if (!presentation || !('exportScale' in presentation)) return;
  const { exportScale, ...rest } = presentation;
  value.presentation = rest;
  const exportPrefs = isPlainObject(value.export) ? value.export : {};
  const hasDefault = typeof exportPrefs.defaultScale === 'number';
  if (!hasDefault && typeof exportScale === 'number') {
    value.export = { ...exportPrefs, defaultScale: exportScale };
    changes.push(`export.defaultScale set from presentation.exportScale`);
    return;
  }
  changes.push('presentation.exportScale removed');
}

/** The bundle file name in an old built-in background URL. */
function bundledFileName(url: string): string | null {
  const name = url.split(/[?#]/)[0].split('/').pop() ?? '';
  return BUNDLED_FILE.test(name) ? name : null;
}

async function legacyBackground(
  url: unknown,
  saveBackground: SaveBackground,
  changes: string[],
): Promise<BackgroundImageRef | null> {
  if (typeof url !== 'string' || url === '') return null;
  if (DATA_URL.test(url)) {
    const bytes = Buffer.from(url.slice(url.indexOf(',') + 1), 'base64');
    const saved = await saveBackground(bytes);
    changes.push(
      saved
        ? `background image moved to backgrounds/${saved.kind === 'file' ? saved.id : ''}`
        : 'background image dropped: the stored image could not be read (older versions cut images over 2 MB short)',
    );
    return saved;
  }
  const file = bundledFileName(url);
  changes.push(
    file
      ? `built-in background kept as ${file}`
      : 'background image dropped: unsupported URL',
  );
  return file ? { kind: 'builtin', file } : null;
}

/** presentation.backgroundImageUrl became a file or bundle reference. */
async function migrateBackgroundImage(
  value: PlainRecord,
  saveBackground: SaveBackground,
  changes: string[],
): Promise<void> {
  const presentation = isPlainObject(value.presentation)
    ? value.presentation
    : null;
  if (!presentation || !('backgroundImageUrl' in presentation)) return;
  const { backgroundImageUrl, ...rest } = presentation;
  const backgroundImage =
    'backgroundImage' in rest
      ? rest.backgroundImage
      : await legacyBackground(backgroundImageUrl, saveBackground, changes);
  value.presentation = { ...rest, backgroundImage };
  if (changes.length === 0)
    changes.push('presentation.backgroundImageUrl removed');
}

/**
 * Brings stored preferences from older versions to the current shape. The
 * input is not modified.
 */
export async function migrateStoredPreferences(
  stored: PlainRecord,
  saveBackground: SaveBackground,
): Promise<MigrationResult> {
  const value: PlainRecord = { ...stored };
  const changes: string[] = [];
  migrateExportScale(value, changes);
  const backgroundChanges: string[] = [];
  await migrateBackgroundImage(value, saveBackground, backgroundChanges);
  return { value, changes: [...changes, ...backgroundChanges] };
}

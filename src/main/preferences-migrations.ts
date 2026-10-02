import type { BackgroundImageRef } from '../shared/preferences-types';
import type { BuiltinBackgroundId } from '../shared/builtin-backgrounds';
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

/**
 * Earlier builds named built-in backgrounds by their bundle file, whose name
 * is a hash of the image (webpack's default asset name). These are the names
 * every such build gave assets/backgrounds/<id>.png.
 */
const LEGACY_BUNDLE_FILES: Readonly<Record<string, BuiltinBackgroundId>> = {
  'b795909a0f7d4afdf700.png': '1',
  '855d3f6434f1d21de3ec.png': '2',
  'db26ea34d8811698082e.png': '3',
  '0d52cdb6142e117aeec9.png': '4',
  '481342d562a673cf4ef0.png': '5',
  '645ad88684237fb78cb7.png': '6',
  '5c58e93ca5d2d6f67f1b.png': '7',
  '371b72eae5aa247343e1.png': '8',
};

function builtinFromBundleFile(file: string): BackgroundImageRef | null {
  const id = Object.hasOwn(LEGACY_BUNDLE_FILES, file)
    ? LEGACY_BUNDLE_FILES[file]
    : undefined;
  return id ? { kind: 'builtin', id } : null;
}

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

/** The bundle file name at the end of an old built-in background URL. */
const bundledFileName = (url: string): string =>
  url.split(/[?#]/)[0].split('/').pop() ?? '';

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
  const builtin = builtinFromBundleFile(bundledFileName(url));
  changes.push(
    builtin?.kind === 'builtin'
      ? `built-in background kept as ${builtin.id}`
      : 'background image dropped: unsupported URL',
  );
  return builtin;
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

/** A built-in background saved by its bundle file now uses its stable id. */
function migrateBuiltinBackground(value: PlainRecord, changes: string[]): void {
  const presentation = isPlainObject(value.presentation)
    ? value.presentation
    : null;
  const saved = presentation?.backgroundImage;
  if (!presentation || !isPlainObject(saved) || saved.kind !== 'builtin') {
    return;
  }
  if (typeof saved.file !== 'string') return;
  const builtin = builtinFromBundleFile(saved.file);
  value.presentation = { ...presentation, backgroundImage: builtin };
  changes.push(
    builtin?.kind === 'builtin'
      ? `built-in background ${saved.file} is now ${builtin.id}`
      : `built-in background dropped: unknown bundle file ${saved.file}`,
  );
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
  migrateBuiltinBackground(value, backgroundChanges);
  return { value, changes: [...changes, ...backgroundChanges] };
}

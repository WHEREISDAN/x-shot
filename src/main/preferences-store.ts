import { promises as fs } from 'fs';
import type {
  AppPreferences,
  PreferencesUpdate,
} from '../shared/preferences-types';
import {
  nodeFileOps,
  removeStaleTempFiles,
  writeFileAtomic,
  type AtomicFileOps,
} from './atomic-write';
import {
  deepMerge,
  isPlainObject,
  sanitizePreferences,
} from './preferences-schema';
import {
  migrateStoredPreferences,
  type SaveBackground,
} from './preferences-migrations';

export interface StoreLogger {
  info: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * ok: the file was read; missing: there was none; recovered: it could not
 * be parsed, so it was backed up and defaults were loaded.
 */
export type LoadOutcome = 'ok' | 'missing' | 'recovered';

export interface PreferencesStoreOptions {
  filePath: string;
  defaults: AppPreferences;
  saveBackground: SaveBackground;
  log: StoreLogger;
  /** Runs after each successful write with what was written. */
  onPersisted?: (written: AppPreferences) => void;
  fileOps?: AtomicFileOps;
  now?: () => Date;
}

export interface PreferencesStore {
  load: () => Promise<AppPreferences>;
  /** How the last load went; null before the first load. */
  loadOutcome: () => LoadOutcome | null;
  /** Merges, sanitizes and persists; rejects if the write fails. */
  update: (updates: PreferencesUpdate) => Promise<AppPreferences>;
  /** Replaces everything, as for a reset to defaults. */
  replace: (preferences: AppPreferences) => Promise<AppPreferences>;
  /** Resolves once every queued write has finished. */
  flush: () => Promise<void>;
}

const errorCode = (error: unknown) => (error as { code?: string }).code;

/**
 * The preferences file and its in-memory copy. The copy changes first, so
 * readers see an update at once; writes then run one at a time, each
 * writing the newest copy atomically, so the file is never half-written and
 * always ends up equal to the last update.
 */
export function createPreferencesStore({
  filePath,
  defaults,
  saveBackground,
  log,
  onPersisted,
  fileOps = nodeFileOps,
  now = () => new Date(),
}: PreferencesStoreOptions): PreferencesStore {
  let cache: AppPreferences | null = null;
  let outcome: LoadOutcome | null = null;
  let loading: Promise<AppPreferences> | null = null;
  let version = 0;
  let writtenVersion = 0;
  let queue: Promise<void> = Promise.resolve();

  /** Writes the newest copy unless a write already covered `target`. */
  const writeLatest = async (target: number): Promise<void> => {
    if (writtenVersion >= target || !cache) return;
    const snapshot = cache;
    const snapshotVersion = version;
    await writeFileAtomic(
      filePath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
      fileOps,
    );
    writtenVersion = Math.max(writtenVersion, snapshotVersion);
    onPersisted?.(snapshot);
  };

  const enqueueWrite = (): Promise<void> => {
    version += 1;
    const target = version;
    const task = queue.then(() => writeLatest(target));
    // A failed write fails its own callers; later writes still run.
    queue = task.catch(() => {});
    return task;
  };

  const backUpCorruptFile = async (reason: string) => {
    const stamp = now().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${filePath}.bak-${stamp}`;
    try {
      await fs.rename(filePath, backupPath);
      log.error(
        `Preferences file could not be read (${reason}); moved it to ${backupPath} and loaded defaults`,
      );
    } catch (error) {
      log.error(
        `Preferences file could not be read (${reason}) or backed up; loaded defaults`,
        error,
      );
    }
  };

  const readStored = async (): Promise<Record<string, unknown> | null> => {
    let text: string;
    try {
      text = await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      if (errorCode(error) !== 'ENOENT') {
        log.error('Failed to read preferences; using defaults', error);
      }
      outcome = 'missing';
      return null;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      if (!isPlainObject(parsed)) throw new Error('not a JSON object');
      outcome = 'ok';
      return parsed;
    } catch (error) {
      await backUpCorruptFile((error as Error).message);
      outcome = 'recovered';
      return null;
    }
  };

  const loadFromDisk = async (): Promise<AppPreferences> => {
    await removeStaleTempFiles(filePath);
    const stored = await readStored();
    if (!stored) {
      cache = sanitizePreferences(defaults, defaults);
      return cache;
    }
    const migrated = await migrateStoredPreferences(stored, saveBackground);
    cache = sanitizePreferences(migrated.value, defaults);
    if (migrated.changes.length > 0) {
      migrated.changes.forEach((change) =>
        log.info(`Preferences migrated: ${change}`),
      );
      await enqueueWrite().catch((error) =>
        log.error('Failed to save migrated preferences', error),
      );
    }
    return cache;
  };

  const load = (): Promise<AppPreferences> => {
    if (cache) return Promise.resolve(cache);
    loading ??= loadFromDisk().finally(() => {
      loading = null;
    });
    return loading;
  };

  const applyUpdate = (updates: PreferencesUpdate): Promise<AppPreferences> => {
    const current = cache ?? defaults;
    const next = sanitizePreferences(deepMerge(current, updates), current);
    cache = next;
    return enqueueWrite().then(() => next);
  };

  // Once loaded, the copy changes in the same tick, so a reader right after
  // update() already sees it.
  const update = (updates: PreferencesUpdate): Promise<AppPreferences> =>
    cache ? applyUpdate(updates) : load().then(() => applyUpdate(updates));

  const replace = async (
    preferences: AppPreferences,
  ): Promise<AppPreferences> => {
    await load();
    cache = sanitizePreferences(preferences, defaults);
    const next = cache;
    await enqueueWrite();
    return next;
  };

  return {
    load,
    loadOutcome: () => outcome,
    update,
    replace,
    flush: () => queue,
  };
}

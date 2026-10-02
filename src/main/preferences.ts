import { app, nativeImage } from 'electron';
import path from 'path';
import log from 'electron-log';
import type {
  AppPreferences,
  BackgroundImageRef,
  PreferencesUpdate,
} from '../shared/preferences-types';
import {
  createBackgroundStore,
  imageExtension,
  type BackgroundStore,
} from './background-images';
import {
  createDefaultPreferences,
  sanitizePreferences,
} from './preferences-schema';
import {
  createPreferencesStore,
  type PreferencesStore,
} from './preferences-store';

export { sanitizeFilenamePattern } from './preferences-schema';

const PREFERENCES_FILE = 'preferences.json';
const BACKGROUNDS_DIR = 'backgrounds';

let backgrounds: BackgroundStore | null = null;
let store: PreferencesStore | null = null;

const fileBackgroundId = (preferences: AppPreferences): string | null => {
  const image = preferences.presentation.backgroundImage;
  return image?.kind === 'file' ? image.id : null;
};

export function getBackgroundStore(): BackgroundStore {
  backgrounds ??= createBackgroundStore(
    path.join(app.getPath('userData'), BACKGROUNDS_DIR),
  );
  return backgrounds;
}

/**
 * Stores user image bytes as a background. PNG and JPEG must also decode,
 * which catches files older versions cut short.
 */
export async function saveBackgroundImage(
  bytes: Uint8Array,
): Promise<BackgroundImageRef> {
  const extension = imageExtension(bytes);
  if (
    (extension === 'png' || extension === 'jpg') &&
    nativeImage.createFromBuffer(Buffer.from(bytes)).isEmpty()
  ) {
    throw new Error('The image could not be read.');
  }
  return getBackgroundStore().save(bytes);
}

function getStore(): PreferencesStore {
  if (store) return store;
  let persistedBackground: string | null | undefined;
  store = createPreferencesStore({
    filePath: path.join(app.getPath('userData'), PREFERENCES_FILE),
    defaults: createDefaultPreferences(app.getPath('pictures')),
    saveBackground: (bytes) =>
      saveBackgroundImage(bytes).catch((error) => {
        log.warn('Could not keep a stored background image', error);
        return null;
      }),
    log,
    // A background the preferences no longer use is deleted once that is
    // on disk. Images added but never used go at the next start.
    onPersisted: (written) => {
      const current = fileBackgroundId(written);
      if (persistedBackground && persistedBackground !== current) {
        getBackgroundStore()
          .removeExcept(current ? [current] : [])
          .catch((error) => log.warn('Failed to delete a background', error));
      }
      persistedBackground = current;
    },
  });
  return store;
}

export async function loadPreferences(): Promise<AppPreferences> {
  const current = getStore();
  const firstLoad = current.loadOutcome() === null;
  const preferences = await current.load();
  // After a recovery the backed-up file may still name a background.
  if (firstLoad && current.loadOutcome() !== 'recovered') {
    const keep = fileBackgroundId(preferences);
    await getBackgroundStore()
      .removeExcept(keep ? [keep] : [])
      .catch((error) => log.warn('Failed to clean up backgrounds', error));
  }
  return preferences;
}

/** Merges a partial update deeply; rejects if it cannot be saved. */
export async function updatePreferences(
  updates: PreferencesUpdate,
): Promise<AppPreferences> {
  return getStore().update(updates);
}

export function getDefaultPreferences(): AppPreferences {
  const defaults = createDefaultPreferences(app.getPath('pictures'));
  return sanitizePreferences(defaults, defaults);
}

export async function resetPreferences(): Promise<AppPreferences> {
  return getStore().replace(getDefaultPreferences());
}

/** Resolves once every queued preferences write has finished. */
export function flushPreferences(): Promise<void> {
  return store ? store.flush() : Promise.resolve();
}

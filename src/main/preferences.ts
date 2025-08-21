import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';
import log from 'electron-log';
import type { AppPreferences } from '../shared/ipc-types';

const PREFERENCES_FILE = 'preferences.json';

// Default preferences
const DEFAULT_PREFERENCES: AppPreferences = {
  capture: {
    hotkey: 'CommandOrControl+Shift+1',
    hotkeyDelay3: null,
    hotkeyDelay5: null,
    hotkeyRecapture: null,
    defaultSaveLocation: app.getPath('pictures'),
    autoCopyToClipboard: false,
    defaultFormat: 'png',
    lastSelection: null,
  },
  editor: {
    defaultStrokeColor: '#ef4444',
    defaultFillColor: 'transparent',
    defaultStrokeWidth: 3,
    defaultTextSize: 18,
  },
  export: {
    filenamePattern: 'X-Shot_$TIMESTAMP',
    autoSave: false,
    defaultScale: 1,
  },
  system: {
    launchAtStartup: false,
    showInTray: true,
  },
  pii: {
    autoDetect: false,
    defaultStyle: 'black',
    detectors: {
      email: true,
      phone: true,
      address: true,
      ipv4: false,
      url: false,
      ssn: false,
      creditCard: false,
      dob: false,
      postalUS: false,
      postalCA: false,
      postalUK: false,
      uuid: false,
      mac: false,
      iban: false,
      poBox: false,
      tokens: false,
    },
  },
  presentation: {
    gradient: {
      kind: 'linear',
      angleDeg: 45,
      stops: [
        { offset: 0, color: '#7c3aed' },
        { offset: 1, color: '#22d3ee' },
      ],
    },
    backgroundImageUrl: null,
    padding: 48,
    inset: 16,
    radius: 24,
    shadow: {
      enabled: true,
      x: 0,
      y: 18,
      blur: 48,
      spread: 4,
      color: 'rgba(0,0,0,0.35)',
    },
    aspect: { preset: 'auto' },
    exportScale: 1,
    borderColor: '#0b0b0c',
  },
};

let cachedPreferences: AppPreferences | null = null;

/**
 * Get the path to the preferences file
 */
function getPreferencesPath(): string {
  return path.join(app.getPath('userData'), PREFERENCES_FILE);
}

/**
 * Deep merge two preference objects
 */
function mergePreferences(
  defaults: AppPreferences,
  stored: Partial<AppPreferences>,
): AppPreferences {
  const result = { ...defaults };

  Object.entries(stored).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      (result as any)[key] = {
        ...(result as any)[key],
        ...value,
      };
    } else {
      (result as any)[key] = value;
    }
  });

  return result;
}

/**
 * Load preferences from disk
 */
export async function loadPreferences(): Promise<AppPreferences> {
  if (cachedPreferences) {
    return cachedPreferences;
  }

  try {
    const preferencesPath = getPreferencesPath();
    const data = await fs.readFile(preferencesPath, 'utf-8');
    const storedPreferences = JSON.parse(data) as Partial<AppPreferences>;

    // Merge with defaults to ensure all required fields exist
    cachedPreferences = mergePreferences(
      DEFAULT_PREFERENCES,
      storedPreferences,
    );

    log.info('Preferences loaded successfully');
    return cachedPreferences;
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      log.info('No preferences file found, using defaults');
    } else {
      log.error('Failed to load preferences:', error);
    }

    cachedPreferences = { ...DEFAULT_PREFERENCES };
    return cachedPreferences;
  }
}

/**
 * Save preferences to disk
 */
export async function savePreferences(
  preferences: AppPreferences,
): Promise<boolean> {
  try {
    const preferencesPath = getPreferencesPath();

    // Ensure the user data directory exists
    await fs.mkdir(path.dirname(preferencesPath), { recursive: true });

    // Write preferences to file
    await fs.writeFile(
      preferencesPath,
      JSON.stringify(preferences, null, 2),
      'utf-8',
    );

    // Update cache
    cachedPreferences = preferences;

    log.info('Preferences saved successfully');
    return true;
  } catch (error) {
    log.error('Failed to save preferences:', error);
    return false;
  }
}

/**
 * Update specific preference values
 */
export async function updatePreferences(
  updates: Partial<AppPreferences>,
): Promise<AppPreferences> {
  const currentPreferences = await loadPreferences();
  const newPreferences = mergePreferences(currentPreferences, updates);

  await savePreferences(newPreferences);
  return newPreferences;
}

/**
 * Reset preferences to defaults
 */
export async function resetPreferences(): Promise<AppPreferences> {
  const defaultPrefs = { ...DEFAULT_PREFERENCES };
  await savePreferences(defaultPrefs);
  return defaultPrefs;
}

/**
 * Get default preferences (useful for UI)
 */
export function getDefaultPreferences(): AppPreferences {
  return { ...DEFAULT_PREFERENCES };
}

/**
 * Migrate localStorage preferences to the new system
 * This should be called once during app initialization
 */
export async function migrateLocalStoragePreferences(): Promise<void> {
  try {
    // Check if migration has already been done
    const existingPrefs = await loadPreferences();
    if (existingPrefs !== DEFAULT_PREFERENCES) {
      log.info('Preferences already exist, skipping migration');
      return;
    }

    log.info('Starting localStorage preferences migration');

    log.info('localStorage migration will be handled by renderer process');
  } catch (error) {
    log.error('Failed to migrate localStorage preferences:', error);
  }
}

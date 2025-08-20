import safeLocalStorage from './storage';
import type {
  AppPreferences,
  PresentationSettings,
} from '../../shared/ipc-types';

/**
 * Migrate localStorage preferences to the new unified system
 */
export async function migrateLocalStoragePreferences(): Promise<boolean> {
  try {
    console.log('Starting localStorage preferences migration...');

    const api = window?.electron?.ipcRenderer;
    if (!api) {
      console.warn('Electron IPC not available, skipping migration');
      return false;
    }

    // Check if we already have preferences
    const existingPrefs = await api.invoke('get-preferences', {});

    // Simple check to see if this looks like default preferences
    // If they have non-default values, assume migration already happened
    if (
      existingPrefs.capture.hotkey !== 'CommandOrControl+Shift+1' ||
      existingPrefs.editor.defaultStrokeColor !== '#ef4444' ||
      existingPrefs.presentation.padding !== 48
    ) {
      console.log('Preferences already customized, skipping migration');
      return false;
    }

    const updates: Partial<AppPreferences> = {};
    let migrated = false;

    // Migrate presentation settings
    const presentationData = safeLocalStorage.getItem('xshot:presentation');
    if (presentationData) {
      try {
        const presentation = JSON.parse(
          presentationData,
        ) as PresentationSettings;
        updates.presentation = presentation;
        migrated = true;
        console.log('Migrated presentation settings');
      } catch (error) {
        console.warn('Failed to parse presentation settings:', error);
      }
    }

    // Migrate PII settings (if they exist)
    const piiData = safeLocalStorage.getItem('xshot:pii');
    if (piiData) {
      try {
        const piiSettings = JSON.parse(piiData);
        if (
          piiSettings.autoDetect !== undefined ||
          piiSettings.defaultStyle !== undefined ||
          piiSettings.detectors !== undefined
        ) {
          updates.pii = {
            autoDetect: piiSettings.autoDetect ?? false,
            defaultStyle: piiSettings.defaultStyle ?? 'black',
            detectors: piiSettings.detectors ?? {
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
          } as any;
          migrated = true;
          console.log('Migrated PII settings');
        }
      } catch (error) {
        console.warn('Failed to parse PII settings:', error);
      }
    }

    // Apply migrations if any were found
    if (migrated) {
      const success = await api.invoke('set-preferences', {
        preferences: updates,
      });
      if (success) {
        console.log('Successfully migrated localStorage preferences');

        // Clean up old localStorage keys
        safeLocalStorage.removeItem('xshot:presentation');
        safeLocalStorage.removeItem('xshot:pii');

        return true;
      }
      console.error('Failed to save migrated preferences');
      return false;
    }
    console.log('No localStorage preferences found to migrate');
    return false;
  } catch (error) {
    console.error('Error during localStorage migration:', error);
    return false;
  }
}

/**
 * Check if migration is needed and perform it
 */
export async function checkAndMigrateIfNeeded(): Promise<void> {
  // Only run migration once per session
  if (sessionStorage.getItem('xshot:migration-checked')) {
    return;
  }

  try {
    await migrateLocalStoragePreferences();
  } finally {
    sessionStorage.setItem('xshot:migration-checked', 'true');
  }
}

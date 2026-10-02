import type { AppPreferences } from '../../shared/ipc-types';

/** A full preferences object, as main returns it. */
const PREFERENCES: AppPreferences = {
  capture: {
    hotkey: 'CommandOrControl+Shift+1',
    hotkeyDelay3: 'CommandOrControl+Shift+3',
    hotkeyDelay5: null,
    hotkeyRecapture: null,
    defaultSaveLocation: '/tmp',
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
  system: { launchAtStartup: false, showInTray: true },
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
    backgroundImage: null,
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
    borderColor: '#0b0b0c',
  },
};

export default PREFERENCES;

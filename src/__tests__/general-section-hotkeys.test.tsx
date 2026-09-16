import { fireEvent, render, screen } from '@testing-library/react';
import GeneralSection from '../renderer/components/preferences/GeneralSection';
import type { AppPreferences } from '../shared/ipc-types';

const preferences: AppPreferences = {
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

const META_W = { key: 'w', code: 'KeyW', metaKey: true };

function renderSection() {
  const onUpdate = jest.fn().mockResolvedValue(true);
  render(<GeneralSection preferences={preferences} onUpdate={onUpdate} />);
  return {
    onUpdate,
    mainInput: screen.getByDisplayValue(preferences.capture.hotkey),
    delayInput: screen.getByDisplayValue(
      preferences.capture.hotkeyDelay3 as string,
    ),
  };
}

describe('GeneralSection hotkey recorder', () => {
  it('records one combo while focused, then stops listening', () => {
    const { onUpdate, mainInput } = renderSection();
    fireEvent.focus(mainInput);
    fireEvent.keyDown(mainInput, META_W);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { ...preferences.capture, hotkey: 'CommandOrControl+W' },
    });

    fireEvent.keyDown(window, { key: 'q', code: 'KeyQ', metaKey: true });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('ignores combos pressed after the field loses focus', () => {
    const { onUpdate, mainInput } = renderSection();
    fireEvent.focus(mainInput);
    fireEvent.blur(mainInput);
    fireEvent.keyDown(window, META_W);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('cancels recording on Escape without saving', () => {
    const { onUpdate, mainInput } = renderSection();
    fireEvent.focus(mainInput);
    fireEvent.keyDown(mainInput, { key: 'Escape', code: 'Escape' });
    fireEvent.keyDown(window, META_W);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('clears an optional hotkey with Backspace', () => {
    const { onUpdate, delayInput } = renderSection();
    fireEvent.focus(delayInput);
    fireEvent.keyDown(delayInput, { key: 'Backspace', code: 'Backspace' });
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { ...preferences.capture, hotkeyDelay3: null },
    });
  });

  it('does not clear the required main hotkey with Backspace', () => {
    const { onUpdate, mainInput } = renderSection();
    fireEvent.focus(mainInput);
    fireEvent.keyDown(mainInput, { key: 'Backspace', code: 'Backspace' });
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.keyDown(mainInput, META_W);
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { ...preferences.capture, hotkey: 'CommandOrControl+W' },
    });
  });
});

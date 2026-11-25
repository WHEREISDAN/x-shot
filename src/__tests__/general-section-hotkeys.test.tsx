import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import GeneralSection from '../renderer/components/preferences/GeneralSection';
import PREFERENCES from './fixtures/preferences';

const preferences = PREFERENCES;

const META_W = { key: 'w', code: 'KeyW', metaKey: true };

/** The key caps a hotkey button shows, in order. */
const keyCaps = (button: HTMLElement) =>
  Array.from(button.querySelectorAll('kbd kbd'), (cap) => cap.textContent);

function renderSection() {
  const onUpdate = jest.fn().mockResolvedValue(true);
  render(<GeneralSection preferences={preferences} onUpdate={onUpdate} />);
  return {
    onUpdate,
    mainHotkey: screen.getByRole('button', { name: /^Global Hotkey/ }),
    delayHotkey: screen.getByRole('button', {
      name: /^Delayed Capture \(3s\)/,
    }),
  };
}

describe('GeneralSection hotkey recorder', () => {
  it('shows each hotkey as key caps and an unset one as a button', () => {
    const { mainHotkey, delayHotkey } = renderSection();
    // jsdom is not a Mac, so CommandOrControl reads as Ctrl.
    expect(keyCaps(mainHotkey)).toEqual(['Ctrl', 'Shift', '1']);
    expect(mainHotkey).toHaveAccessibleName('Global Hotkey Ctrl Shift 1');
    expect(keyCaps(delayHotkey)).toEqual(['Ctrl', 'Shift', '3']);
    expect(
      screen.getByRole('button', { name: /^Delayed Capture \(5s\)/ }),
    ).toHaveTextContent('Record shortcut');
  });

  it('records one combo after a click, then stops listening', () => {
    const { onUpdate, mainHotkey } = renderSection();
    fireEvent.click(mainHotkey);
    expect(mainHotkey).toHaveTextContent('Press shortcut…');
    fireEvent.keyDown(mainHotkey, META_W);
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { hotkey: 'CommandOrControl+W' },
    });
    expect(mainHotkey).not.toHaveTextContent('Press shortcut…');

    fireEvent.keyDown(window, { key: 'q', code: 'KeyQ', metaKey: true });
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });

  it('ignores combos pressed after the button loses focus', () => {
    const { onUpdate, mainHotkey } = renderSection();
    fireEvent.click(mainHotkey);
    fireEvent.blur(mainHotkey);
    fireEvent.keyDown(window, META_W);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('cancels recording on Escape without saving', () => {
    const { onUpdate, mainHotkey } = renderSection();
    fireEvent.click(mainHotkey);
    fireEvent.keyDown(mainHotkey, { key: 'Escape', code: 'Escape' });
    expect(keyCaps(mainHotkey)).toEqual(['Ctrl', 'Shift', '1']);
    fireEvent.keyDown(window, META_W);
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('clears an optional hotkey with Backspace', () => {
    const { onUpdate, delayHotkey } = renderSection();
    fireEvent.click(delayHotkey);
    fireEvent.keyDown(delayHotkey, { key: 'Backspace', code: 'Backspace' });
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { hotkeyDelay3: null },
    });
  });

  it('does not clear the required main hotkey with Backspace', () => {
    const { onUpdate, mainHotkey } = renderSection();
    fireEvent.click(mainHotkey);
    fireEvent.keyDown(mainHotkey, { key: 'Backspace', code: 'Backspace' });
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.keyDown(mainHotkey, META_W);
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { hotkey: 'CommandOrControl+W' },
    });
  });

  it('disables and annotates Launch at startup on Linux', async () => {
    const prevElectron = (window as unknown as { electron?: unknown }).electron;
    (window as unknown as { electron: unknown }).electron = {
      platform: 'linux',
      ipcRenderer: { invoke: jest.fn(async () => '/home/alex') },
    };
    try {
      const { onUpdate } = renderSection();
      await act(async () => {});
      const startupSwitch = screen.getByRole('switch', {
        name: 'Launch X-Shot at system startup',
      });
      expect(startupSwitch).toBeDisabled();
      expect(startupSwitch).not.toBeChecked();
      expect(startupSwitch).toHaveAccessibleDescription(
        /not supported on linux/i,
      );
      fireEvent.click(startupSwitch);
      expect(onUpdate).not.toHaveBeenCalled();
    } finally {
      (window as unknown as { electron?: unknown }).electron = prevElectron;
    }
  });
});

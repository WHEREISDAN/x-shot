import { fireEvent, render, screen } from '@testing-library/react';
import GeneralSection from '../renderer/components/preferences/GeneralSection';
import PREFERENCES from './fixtures/preferences';

const preferences = PREFERENCES;

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
      capture: { hotkey: 'CommandOrControl+W' },
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
      capture: { hotkeyDelay3: null },
    });
  });

  it('does not clear the required main hotkey with Backspace', () => {
    const { onUpdate, mainInput } = renderSection();
    fireEvent.focus(mainInput);
    fireEvent.keyDown(mainInput, { key: 'Backspace', code: 'Backspace' });
    expect(onUpdate).not.toHaveBeenCalled();

    fireEvent.keyDown(mainInput, META_W);
    expect(onUpdate).toHaveBeenCalledWith({
      capture: { hotkey: 'CommandOrControl+W' },
    });
  });
});

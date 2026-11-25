import acceleratorFromKeyEvent from '../renderer/components/preferences/hotkey-accelerator';

describe('acceleratorFromKeyEvent', () => {
  it('derives digits from code for Shift+digit combos like Cmd/Ctrl+Shift+1', () => {
    const cmdShift1 = new KeyboardEvent('keydown', {
      metaKey: true,
      shiftKey: true,
      key: '!',
      code: 'Digit1',
    });
    const ctrlShift1 = new KeyboardEvent('keydown', {
      ctrlKey: true,
      shiftKey: true,
      key: '!',
      code: 'Digit1',
    });
    expect(acceleratorFromKeyEvent(cmdShift1)).toBe('CommandOrControl+Shift+1');
    expect(acceleratorFromKeyEvent(ctrlShift1)).toBe(
      'CommandOrControl+Shift+1',
    );
  });

  it('derives letters and digits from code for macOS Option accented characters', () => {
    const cmdOptA = new KeyboardEvent('keydown', {
      metaKey: true,
      altKey: true,
      key: 'å',
      code: 'KeyA',
    });
    const cmdOpt1 = new KeyboardEvent('keydown', {
      metaKey: true,
      altKey: true,
      key: '¡',
      code: 'Digit1',
    });
    expect(acceleratorFromKeyEvent(cmdOptA)).toBe('CommandOrControl+Alt+A');
    expect(acceleratorFromKeyEvent(cmdOpt1)).toBe('CommandOrControl+Alt+1');

    // Bare Option+A / Option+1 without Cmd/Ctrl still cannot hijack text typing.
    const bareOptA = new KeyboardEvent('keydown', {
      altKey: true,
      key: 'å',
      code: 'KeyA',
    });
    const bareOpt1 = new KeyboardEvent('keydown', {
      altKey: true,
      key: '¡',
      code: 'Digit1',
    });
    expect(acceleratorFromKeyEvent(bareOptA)).toBe('');
    expect(acceleratorFromKeyEvent(bareOpt1)).toBe('');
  });

  it('records Space when key is a literal space character and code is Space', () => {
    const cmdShiftSpace = new KeyboardEvent('keydown', {
      metaKey: true,
      shiftKey: true,
      key: ' ',
      code: 'Space',
    });
    expect(acceleratorFromKeyEvent(cmdShiftSpace)).toBe(
      'CommandOrControl+Shift+Space',
    );
  });

  it('falls back to key when code is omitted and allows bare F-keys', () => {
    expect(acceleratorFromKeyEvent({ metaKey: true, key: 'k' })).toBe(
      'CommandOrControl+K',
    );
    expect(acceleratorFromKeyEvent({ ctrlKey: true, key: '7' })).toBe(
      'CommandOrControl+7',
    );
    expect(acceleratorFromKeyEvent({ metaKey: true, key: ' ' })).toBe(
      'CommandOrControl+Space',
    );
    expect(acceleratorFromKeyEvent({ key: 'F8', code: 'F8' })).toBe('F8');
    expect(
      acceleratorFromKeyEvent({ altKey: true, key: 'F8', code: 'F8' }),
    ).toBe('Alt+F8');
  });
});

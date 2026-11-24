/** One key of a shortcut: what its key cap shows and what it is called. */
export interface AcceleratorKey {
  label: string;
  name: string;
}

type KeyTable = Record<string, AcceleratorKey>;

const key = (label: string, name = label): AcceleratorKey => ({ label, name });

const SHARED: KeyTable = {
  up: key('↑', 'Up'),
  down: key('↓', 'Down'),
  left: key('←', 'Left'),
  right: key('→', 'Right'),
  esc: key('Esc', 'Escape'),
  escape: key('Esc', 'Escape'),
  space: key('Space'),
  plus: key('+', 'Plus'),
};

const MAC: KeyTable = {
  ...SHARED,
  commandorcontrol: key('⌘', 'Command'),
  cmdorctrl: key('⌘', 'Command'),
  command: key('⌘', 'Command'),
  cmd: key('⌘', 'Command'),
  meta: key('⌘', 'Command'),
  super: key('⌘', 'Command'),
  control: key('⌃', 'Control'),
  ctrl: key('⌃', 'Control'),
  alt: key('⌥', 'Option'),
  option: key('⌥', 'Option'),
  altgr: key('⌥', 'Option'),
  shift: key('⇧', 'Shift'),
  enter: key('↩', 'Return'),
  return: key('↩', 'Return'),
  backspace: key('⌫', 'Delete'),
  delete: key('⌦', 'Forward Delete'),
  tab: key('⇥', 'Tab'),
};

const OTHER: KeyTable = {
  ...SHARED,
  commandorcontrol: key('Ctrl'),
  cmdorctrl: key('Ctrl'),
  control: key('Ctrl'),
  ctrl: key('Ctrl'),
  command: key('Super'),
  cmd: key('Super'),
  meta: key('Super'),
  super: key('Super'),
  alt: key('Alt'),
  option: key('Alt'),
  altgr: key('AltGr'),
  shift: key('Shift'),
  enter: key('Enter'),
  return: key('Enter'),
  backspace: key('Backspace'),
  delete: key('Delete'),
  tab: key('Tab'),
};

/** True when the renderer runs on macOS. */
export function isMacPlatform(): boolean {
  return typeof navigator !== 'undefined' && /mac/i.test(navigator.platform);
}

/**
 * The keys of an Electron accelerator such as `CommandOrControl+Shift+1`:
 * `⌘ ⇧ 1` on macOS, `Ctrl Shift 1` on Windows and Linux.
 */
export function acceleratorKeys(
  accelerator: string,
  mac: boolean = isMacPlatform(),
): AcceleratorKey[] {
  const table = mac ? MAC : OTHER;
  // `+` separates keys, so a plus key is written as `Plus` or as a trailing `+`.
  const parts = accelerator.split(/\+(?!$)/).filter(Boolean);
  return parts.map((part) => {
    const known = table[part.toLowerCase()];
    if (known) return known;
    const upper = part.length === 1 ? part.toUpperCase() : part;
    return key(upper);
  });
}

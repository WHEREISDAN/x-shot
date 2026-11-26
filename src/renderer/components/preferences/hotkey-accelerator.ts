/** The parts of a keydown a shortcut is built from. */
export interface ShortcutKeyEvent {
  key?: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
}

/**
 * The Electron accelerator a key press records, or '' when it cannot be a
 * shortcut. Every shortcut needs Command or Control, except F-keys.
 */
export default function acceleratorFromKeyEvent(e: ShortcutKeyEvent): string {
  const parts: string[] = [];
  const hasMeta = e.metaKey || e.ctrlKey;
  if (hasMeta) parts.push('CommandOrControl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  const rawKey = e.key || '';
  const key = rawKey.toUpperCase();
  const code = e.code || '';
  const isFn = /^F\d{1,2}$/.test(key);
  const digit =
    code.match(/^Digit(\d)$/i)?.[1] ?? (/^[0-9]$/.test(key) ? key : '');
  const letter = /^[A-Z]$/.test(key)
    ? key
    : (code.match(/^Key([A-Z])$/i)?.[1]?.toUpperCase() ?? '');
  const isSpace =
    code.toUpperCase() === 'SPACE' || rawKey === ' ' || key === 'SPACE';
  let finalKey = '';
  if (isFn) finalKey = key;
  else if (isSpace) finalKey = 'Space';
  else if (digit) finalKey = digit;
  else if (letter) finalKey = letter;
  else if (key === 'ARROWUP' || key === 'UP') finalKey = 'Up';
  else if (key === 'ARROWDOWN' || key === 'DOWN') finalKey = 'Down';
  else if (key === 'ARROWLEFT' || key === 'LEFT') finalKey = 'Left';
  else if (key === 'ARROWRIGHT' || key === 'RIGHT') finalKey = 'Right';
  else if (key === 'ESCAPE') finalKey = 'Esc';
  else if (key === 'ENTER' || key === 'RETURN') finalKey = 'Enter';
  if (!finalKey) return '';
  if (!hasMeta && !/^F\d{1,2}$/.test(finalKey)) return '';
  parts.push(finalKey);
  return parts.join('+');
}

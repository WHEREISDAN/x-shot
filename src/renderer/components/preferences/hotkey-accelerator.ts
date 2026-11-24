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
  const key = (e.key || '').toUpperCase();
  const code = (e.code || '').toUpperCase();
  const isFn = /^F\d{1,2}$/.test(key);
  const isLetter = /^[A-Z]$/.test(key);
  const isDigit = /^DIGIT(\d)$/.test(code) || /^[0-9]$/.test(key);
  let finalKey = '';
  if (isFn) finalKey = key;
  else if (isLetter) finalKey = key;
  else if (isDigit) finalKey = key.match(/\d/)?.[0] ?? key;
  else if (key === 'ARROWUP' || key === 'UP') finalKey = 'Up';
  else if (key === 'ARROWDOWN' || key === 'DOWN') finalKey = 'Down';
  else if (key === 'ARROWLEFT' || key === 'LEFT') finalKey = 'Left';
  else if (key === 'ARROWRIGHT' || key === 'RIGHT') finalKey = 'Right';
  else if (key === 'ESCAPE') finalKey = 'Esc';
  else if (key === 'ENTER' || key === 'RETURN') finalKey = 'Enter';
  else if (key === 'SPACE') finalKey = 'Space';
  if (!finalKey) return '';
  if (!hasMeta && !/^F\d{1,2}$/.test(finalKey)) return '';
  parts.push(finalKey);
  return parts.join('+');
}

import type { MenuItemConstructorOptions } from 'electron';
import type { AppPreferences } from '../shared/preferences-types';

export interface CaptureAccelerators {
  main: string;
  delay3: string | null;
  delay5: string | null;
  recapture: string | null;
}

export interface MenuActions {
  showApp: () => void;
  takeScreenshot: () => void;
  recapture: () => void;
  delayedScreenshot: (delayMs: number) => void;
  openPreferences: () => void;
  quit: () => void;
  openProjectPage: () => void;
}

export interface ApplicationMenuOptions {
  platform: typeof process.platform;
  isDevelopment: boolean;
  accelerators: CaptureAccelerators;
  actions: MenuActions;
}

/** The shortcuts the user saved, as menus show them. */
export function acceleratorsFrom(
  capture: AppPreferences['capture'],
  defaultMain: string,
): CaptureAccelerators {
  return {
    main: capture.hotkey || defaultMain,
    delay3: capture.hotkeyDelay3 || null,
    delay5: capture.hotkeyDelay5 || null,
    recapture: capture.hotkeyRecapture || null,
  };
}

const separator: MenuItemConstructorOptions = { type: 'separator' };

/** The capture items, shared by the application menu and the tray. */
export function captureMenuItems(
  accelerators: CaptureAccelerators,
  actions: MenuActions,
): MenuItemConstructorOptions[] {
  const shortcut = (accelerator: string | null) =>
    accelerator ? { accelerator } : {};
  return [
    { label: 'Show App', click: () => actions.showApp() },
    {
      label: 'Take Screenshot',
      ...shortcut(accelerators.main),
      click: () => actions.takeScreenshot(),
    },
    {
      label: 'Re-capture Last Area',
      ...shortcut(accelerators.recapture),
      click: () => actions.recapture(),
    },
    {
      label: 'Delayed Screenshot (3s)',
      ...shortcut(accelerators.delay3),
      click: () => actions.delayedScreenshot(3000),
    },
    {
      label: 'Delayed Screenshot (5s)',
      ...shortcut(accelerators.delay5),
      click: () => actions.delayedScreenshot(5000),
    },
    separator,
    { label: 'Preferences...', click: () => actions.openPreferences() },
    separator,
    { label: 'Quit', click: () => actions.quit() },
  ];
}

function viewMenu(
  isMac: boolean,
  isDevelopment: boolean,
): MenuItemConstructorOptions {
  const fullScreen: MenuItemConstructorOptions = {
    role: 'togglefullscreen',
    accelerator: isMac ? 'Ctrl+Command+F' : 'F11',
  };
  const developer: MenuItemConstructorOptions[] = [
    { role: 'reload', accelerator: isMac ? 'Command+R' : 'Ctrl+R' },
    fullScreen,
    {
      role: 'toggleDevTools',
      accelerator: isMac ? 'Alt+Command+I' : 'Alt+Ctrl+I',
    },
  ];
  return {
    label: isMac ? 'View' : '&View',
    submenu: isDevelopment ? developer : [fullScreen],
  };
}

/**
 * The application menu. Standard items use Electron roles, so they act on
 * the focused window and text fields get working Edit commands.
 */
export function applicationMenuTemplate({
  platform,
  isDevelopment,
  accelerators,
  actions,
}: ApplicationMenuOptions): MenuItemConstructorOptions[] {
  const isMac = platform === 'darwin';
  const capture: MenuItemConstructorOptions = {
    label: isMac ? 'Capture' : '&Capture',
    submenu: captureMenuItems(accelerators, actions),
  };
  const help: MenuItemConstructorOptions = {
    role: 'help',
    submenu: [
      { label: 'X-Shot on GitHub', click: () => actions.openProjectPage() },
    ],
  };
  if (!isMac) {
    return [
      { label: '&File', submenu: [{ role: 'close', label: '&Close' }] },
      capture,
      viewMenu(false, isDevelopment),
      help,
    ];
  }
  return [
    {
      role: 'appMenu',
      submenu: [
        { role: 'about' },
        separator,
        { role: 'services' },
        separator,
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        separator,
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        separator,
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    capture,
    viewMenu(true, isDevelopment),
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
        separator,
        { role: 'front' },
      ],
    },
    help,
  ];
}

/**
 * @jest-environment node
 */
import type { MenuItemConstructorOptions } from 'electron';
import {
  acceleratorsFrom,
  applicationMenuTemplate,
  captureMenuItems,
  type CaptureAccelerators,
  type MenuActions,
} from '../main/menu-template';
import PREFERENCES from './fixtures/preferences';

const ACCELERATORS: CaptureAccelerators = {
  main: 'CommandOrControl+Alt+F7',
  delay3: 'CommandOrControl+Alt+F8',
  delay5: 'CommandOrControl+Alt+F9',
  recapture: 'CommandOrControl+Alt+F10',
};

function actions(): jest.Mocked<MenuActions> {
  return {
    showApp: jest.fn(),
    takeScreenshot: jest.fn(),
    recapture: jest.fn(),
    delayedScreenshot: jest.fn(),
    openPreferences: jest.fn(),
    quit: jest.fn(),
    openProjectPage: jest.fn(),
  };
}

const submenuOf = (item: MenuItemConstructorOptions | undefined) =>
  (item?.submenu ?? []) as MenuItemConstructorOptions[];

const byLabel = (items: MenuItemConstructorOptions[], label: string) =>
  items.find((item) => item.label?.replace(/&/g, '') === label);

const click = (item: MenuItemConstructorOptions | undefined) =>
  (item?.click as () => void)();

const allItems = (
  items: MenuItemConstructorOptions[],
): MenuItemConstructorOptions[] =>
  items.flatMap((item) => [item, ...allItems(submenuOf(item))]);

const template = (
  platform: typeof process.platform,
  isDevelopment = false,
  menuActions = actions(),
) =>
  applicationMenuTemplate({
    platform,
    isDevelopment,
    accelerators: ACCELERATORS,
    actions: menuActions,
  });

describe('acceleratorsFrom', () => {
  it('uses the saved shortcuts and the default for an empty main one', () => {
    expect(
      acceleratorsFrom(
        {
          ...PREFERENCES.capture,
          hotkey: '',
          hotkeyDelay3: 'CommandOrControl+Alt+F8',
          hotkeyDelay5: undefined,
          hotkeyRecapture: null,
        },
        'CommandOrControl+Shift+1',
      ),
    ).toEqual({
      main: 'CommandOrControl+Shift+1',
      delay3: 'CommandOrControl+Alt+F8',
      delay5: null,
      recapture: null,
    });
  });
});

describe('captureMenuItems', () => {
  it('shows every saved shortcut', () => {
    const items = captureMenuItems(ACCELERATORS, actions());
    expect(
      [
        'Take Screenshot',
        'Delayed Screenshot (3s)',
        'Delayed Screenshot (5s)',
        'Re-capture Last Area',
      ].map((label) => byLabel(items, label)?.accelerator),
    ).toEqual([
      'CommandOrControl+Alt+F7',
      'CommandOrControl+Alt+F8',
      'CommandOrControl+Alt+F9',
      'CommandOrControl+Alt+F10',
    ]);
  });

  it('leaves items without a shortcut unbound', () => {
    const items = captureMenuItems(
      { ...ACCELERATORS, delay3: null, recapture: null },
      actions(),
    );
    expect(byLabel(items, 'Delayed Screenshot (3s)')).not.toHaveProperty(
      'accelerator',
    );
    expect(byLabel(items, 'Re-capture Last Area')).not.toHaveProperty(
      'accelerator',
    );
  });

  it('runs the matching action for each item', () => {
    const menuActions = actions();
    const items = captureMenuItems(ACCELERATORS, menuActions);
    click(byLabel(items, 'Show App'));
    click(byLabel(items, 'Take Screenshot'));
    click(byLabel(items, 'Re-capture Last Area'));
    click(byLabel(items, 'Delayed Screenshot (3s)'));
    click(byLabel(items, 'Delayed Screenshot (5s)'));
    click(byLabel(items, 'Preferences...'));
    click(byLabel(items, 'Quit'));
    expect(menuActions.showApp).toHaveBeenCalledTimes(1);
    expect(menuActions.takeScreenshot).toHaveBeenCalledTimes(1);
    expect(menuActions.recapture).toHaveBeenCalledTimes(1);
    expect(menuActions.delayedScreenshot.mock.calls).toEqual([[3000], [5000]]);
    expect(menuActions.openPreferences).toHaveBeenCalledTimes(1);
    expect(menuActions.quit).toHaveBeenCalledTimes(1);
  });
});

describe('applicationMenuTemplate', () => {
  it.each(['darwin', 'win32', 'linux'] as const)(
    'on %s, the Capture menu carries the saved shortcuts',
    (platform) => {
      const capture = submenuOf(byLabel(template(platform), 'Capture'));
      expect(byLabel(capture, 'Take Screenshot')?.accelerator).toBe(
        ACCELERATORS.main,
      );
      expect(byLabel(capture, 'Delayed Screenshot (5s)')?.accelerator).toBe(
        ACCELERATORS.delay5,
      );
    },
  );

  it('on macOS, the Edit menu uses roles so text fields can edit', () => {
    const edit = submenuOf(byLabel(template('darwin'), 'Edit'));
    expect(edit.map((item) => item.role ?? item.type)).toEqual([
      'undo',
      'redo',
      'separator',
      'cut',
      'copy',
      'paste',
      'selectAll',
    ]);
  });

  it('on macOS, app and window items are roles, not legacy selectors', () => {
    const menu = template('darwin');
    const appMenu = menu.find((item) => item.role === 'appMenu');
    expect(
      submenuOf(appMenu)
        .filter((item) => item.type !== 'separator')
        .map((item) => item.role),
    ).toEqual(['about', 'services', 'hide', 'hideOthers', 'unhide', 'quit']);
    const windowMenu = submenuOf(byLabel(menu, 'Window'));
    expect(
      windowMenu.filter((item) => item.role).map((item) => item.role),
    ).toEqual(['minimize', 'close', 'front']);
    expect(allItems(menu).some((item) => 'selector' in item)).toBe(false);
  });

  it('on Windows and Linux, File has a working Close and no dead Open', () => {
    const file = submenuOf(byLabel(template('win32'), 'File'));
    expect(file).toEqual([{ role: 'close', label: '&Close' }]);
  });

  it.each(['darwin', 'win32'] as const)(
    'on %s, developer items appear only in development',
    (platform) => {
      const roles = (isDevelopment: boolean) =>
        allItems(template(platform, isDevelopment)).map((item) => item.role);
      expect(roles(false)).not.toContain('toggleDevTools');
      expect(roles(false)).not.toContain('reload');
      expect(roles(true)).toEqual(
        expect.arrayContaining(['toggleDevTools', 'reload']),
      );
      expect(roles(false)).toContain('togglefullscreen');
    },
  );

  it.each(['darwin', 'linux'] as const)(
    'on %s, Help links to the project, not to Electron',
    (platform) => {
      const menuActions = actions();
      const help = template(platform, false, menuActions).find(
        (item) => item.role === 'help',
      );
      const items = submenuOf(help);
      expect(items.map((item) => item.label)).toEqual(['X-Shot on GitHub']);
      click(items[0]);
      expect(menuActions.openProjectPage).toHaveBeenCalledTimes(1);
    },
  );
});

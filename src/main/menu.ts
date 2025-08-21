import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
  ipcMain,
} from 'electron';
import { DEFAULT_SCREENSHOT_ACCELERATOR } from './hotkeys';
import { loadPreferences } from './preferences';
// Avoid static imports from './windows' to prevent cycles.

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): Menu {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
      this.setupDevelopmentEnvironment();
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);

    return menu;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const appName = app.getName?.() || 'X-Shot';
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: appName,
      submenu: [
        {
          label: `About ${appName}`,
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: `Hide ${appName}`,
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            this.mainWindow.webContents.toggleDevTools();
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('https://electronjs.org');
          },
        },
        {
          label: 'Documentation',
          click() {
            shell.openExternal(
              'https://github.com/electron/electron/tree/main/docs#readme',
            );
          },
        },
        {
          label: 'Community Discussions',
          click() {
            shell.openExternal('https://www.electronjs.org/community');
          },
        },
        {
          label: 'Search Issues',
          click() {
            shell.openExternal('https://github.com/electron/electron/issues');
          },
        },
      ],
    };

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    const subMenuCapture: MenuItemConstructorOptions = {
      label: 'Capture',
      submenu: this.buildCaptureMenuItems(),
    };

    return [
      subMenuAbout,
      subMenuEdit,
      subMenuCapture,
      subMenuView,
      subMenuWindow,
      subMenuHelp,
    ];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&File',
        submenu: [
          {
            label: '&Open',
            accelerator: 'Ctrl+O',
          },
          {
            label: '&Close',
            accelerator: 'Ctrl+W',
            click: () => {
              this.mainWindow.close();
            },
          },
        ],
      },
      {
        label: '&Capture',
        submenu: this.buildCaptureMenuItems(),
      },
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
            ? [
                {
                  label: '&Reload',
                  accelerator: 'Ctrl+R',
                  click: () => {
                    this.mainWindow.webContents.reload();
                  },
                },
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
                {
                  label: 'Toggle &Developer Tools',
                  accelerator: 'Alt+Ctrl+I',
                  click: () => {
                    this.mainWindow.webContents.toggleDevTools();
                  },
                },
              ]
            : [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () => {
                    this.mainWindow.setFullScreen(
                      !this.mainWindow.isFullScreen(),
                    );
                  },
                },
              ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Learn More',
            click() {
              shell.openExternal('https://electronjs.org');
            },
          },
          {
            label: 'Documentation',
            click() {
              shell.openExternal(
                'https://github.com/electron/electron/tree/main/docs#readme',
              );
            },
          },
          {
            label: 'Community Discussions',
            click() {
              shell.openExternal('https://www.electronjs.org/community');
            },
          },
          {
            label: 'Search Issues',
            click() {
              shell.openExternal('https://github.com/electron/electron/issues');
            },
          },
        ],
      },
    ];

    return templateDefault;
  }

  private triggerScreenshotNow(): void {
    try {
      if (this.mainWindow) this.mainWindow.hide();
      ipcMain.emit('screenshot-capture');
    } catch {
      // Swallow to avoid breaking menu click
    }
  }

  buildCaptureMenuItems(accelerators?: {
    main?: string | null;
    delay3?: string | null;
    delay5?: string | null;
    recapture?: string | null;
  }): MenuItemConstructorOptions[] {
    const mainAcc = accelerators?.main || DEFAULT_SCREENSHOT_ACCELERATOR;
    const delay3Acc = accelerators?.delay3 || undefined;
    const delay5Acc = accelerators?.delay5 || undefined;
    const recaptureAcc = accelerators?.recapture || undefined;

    return [
      {
        label: 'Show App',
        click: () => {
          const anyOpen = BrowserWindow.getAllWindows().find(
            (w) => !w.isDestroyed(),
          );
          if (anyOpen) {
            anyOpen.show();
            anyOpen.focus();
          } else {
            // Defer to app's activate handler to create the main window
            app.emit('activate');
          }
        },
      },
      {
        label: 'Take Screenshot',
        accelerator: mainAcc || undefined,
        click: () => this.triggerScreenshotNow(),
      },
      {
        label: 'Re-capture Last Area',
        accelerator: recaptureAcc,
        click: async () => {
          try {
            const prefs = await loadPreferences();
            const last = prefs.capture.lastSelection;
            if (last) {
              ipcMain.emit('screenshot-data', undefined, {
                x: last.x,
                y: last.y,
                width: last.width,
                height: last.height,
              });
            }
          } catch {
            // noop
          }
        },
      },
      {
        label: 'Delayed Screenshot (3s)',
        accelerator: delay3Acc,
        click: () => setTimeout(() => this.triggerScreenshotNow(), 3000),
      },
      {
        label: 'Delayed Screenshot (5s)',
        accelerator: delay5Acc,
        click: () => setTimeout(() => this.triggerScreenshotNow(), 5000),
      },
      { type: 'separator' },
      {
        label: 'Preferences...',
        click: () => {
          ipcMain.emit('open-preferences');
        },
      },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.quit();
        },
      },
    ];
  }
}

/**
 * Rebuild and set the Application Menu with current user-configured accelerators.
 */
export async function refreshApplicationMenu(
  mainWindow: BrowserWindow,
): Promise<void> {
  const prefs = await loadPreferences();
  const accelerators = {
    main: prefs.capture.hotkey || DEFAULT_SCREENSHOT_ACCELERATOR,
    delay3: prefs.capture.hotkeyDelay3,
    delay5: prefs.capture.hotkeyDelay5,
    recapture: prefs.capture.hotkeyRecapture,
  } as const;

  const builder = new MenuBuilder(mainWindow);
  const template =
    process.platform === 'darwin'
      ? ((): MenuItemConstructorOptions[] => {
          const appName = app.getName?.() || 'X-Shot';
          const subMenuAbout: DarwinMenuItemConstructorOptions = {
            label: appName,
            submenu: [
              {
                label: `About ${appName}`,
                selector: 'orderFrontStandardAboutPanel:',
              },
              { type: 'separator' },
              { label: 'Services', submenu: [] },
              { type: 'separator' },
              {
                label: `Hide ${appName}`,
                accelerator: 'Command+H',
                selector: 'hide:',
              },
              {
                label: 'Hide Others',
                accelerator: 'Command+Shift+H',
                selector: 'hideOtherApplications:',
              },
              { label: 'Show All', selector: 'unhideAllApplications:' },
              { type: 'separator' },
              {
                label: 'Quit',
                accelerator: 'Command+Q',
                click: () => app.quit(),
              },
            ],
          };

          const subMenuEdit: DarwinMenuItemConstructorOptions = {
            label: 'Edit',
            submenu: [
              { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
              {
                label: 'Redo',
                accelerator: 'Shift+Command+Z',
                selector: 'redo:',
              },
              { type: 'separator' },
              { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
              { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
              { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
              {
                label: 'Select All',
                accelerator: 'Command+A',
                selector: 'selectAll:',
              },
            ],
          };

          const subMenuView: MenuItemConstructorOptions = {
            label: 'View',
            submenu: [
              {
                label: 'Toggle Full Screen',
                accelerator: 'Ctrl+Command+F',
                click: () =>
                  mainWindow.setFullScreen(!mainWindow.isFullScreen()),
              },
            ],
          };

          const subMenuWindow: DarwinMenuItemConstructorOptions = {
            label: 'Window',
            submenu: [
              {
                label: 'Minimize',
                accelerator: 'Command+M',
                selector: 'performMiniaturize:',
              },
              {
                label: 'Close',
                accelerator: 'Command+W',
                selector: 'performClose:',
              },
              { type: 'separator' },
              { label: 'Bring All to Front', selector: 'arrangeInFront:' },
            ],
          };

          const subMenuHelp: MenuItemConstructorOptions = {
            label: 'Help',
            submenu: [
              {
                label: 'Learn More',
                click: () => shell.openExternal('https://electronjs.org'),
              },
            ],
          };

          const subMenuCapture: MenuItemConstructorOptions = {
            label: 'Capture',
            submenu: builder.buildCaptureMenuItems({
              main: accelerators.main,
              delay3: accelerators.delay3,
              delay5: accelerators.delay5,
              recapture: accelerators.recapture,
            }),
          };

          return [
            subMenuAbout,
            subMenuEdit,
            subMenuCapture,
            subMenuView,
            subMenuWindow,
            subMenuHelp,
          ];
        })()
      : ((): MenuItemConstructorOptions[] => {
          return [
            {
              label: '&File',
              submenu: [
                { label: '&Open', accelerator: 'Ctrl+O' },
                {
                  label: '&Close',
                  accelerator: 'Ctrl+W',
                  click: () => mainWindow.close(),
                },
              ],
            },
            {
              label: '&Capture',
              submenu: builder.buildCaptureMenuItems({
                main: accelerators.main,
                delay3: accelerators.delay3,
                delay5: accelerators.delay5,
                recapture: accelerators.recapture,
              }),
            },
            {
              label: '&View',
              submenu: [
                {
                  label: 'Toggle &Full Screen',
                  accelerator: 'F11',
                  click: () =>
                    mainWindow.setFullScreen(!mainWindow.isFullScreen()),
                },
              ],
            },
            {
              label: 'Help',
              submenu: [
                {
                  label: 'Learn More',
                  click: () => shell.openExternal('https://electronjs.org'),
                },
              ],
            },
          ];
        })();

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

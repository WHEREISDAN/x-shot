import React, { useCallback } from 'react';
import type { AppPreferences } from '../../../shared/ipc-types';
import { Input, Select } from '../../design-system';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../design-system/tokens';
import { createRendererLogger } from '../../utils/logger';

const logger = createRendererLogger('preferences-general');

interface GeneralSectionProps {
  preferences: AppPreferences;
  onUpdate: (updates: Partial<AppPreferences>) => Promise<boolean>;
}

export default function GeneralSection({
  preferences,
  onUpdate,
}: GeneralSectionProps) {
  const sectionStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[6],
  };

  const groupStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[3],
  };

  const labelStyles: React.CSSProperties = {
    fontSize: typography.fontSize.base,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing[2],
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing[3],
  };

  const checkboxContainerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  };

  const checkboxStyles: React.CSSProperties = {
    accentColor: colors.primary.DEFAULT,
  };

  const fileInputStyles: React.CSSProperties = {
    display: 'flex',
    gap: spacing[2],
    alignItems: 'center',
  };

  const buttonStyles: React.CSSProperties = {
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.emphasis}`,
    background: colors.surface.default,
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  const handleHotkeyChange = useCallback(
    async (hotkey: string) => {
      await onUpdate({
        capture: {
          ...preferences.capture,
          hotkey,
        },
      });
    },
    [preferences.capture, onUpdate],
  );

  type MinimalKeyEvent = {
    key?: string;
    code?: string;
    metaKey?: boolean;
    ctrlKey?: boolean;
    altKey?: boolean;
    shiftKey?: boolean;
  };

  const buildAcceleratorFromEvent = useCallback((e: MinimalKeyEvent) => {
    const parts: string[] = [];
    // Require at least one modifier for safety unless using F-keys
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
  }, []);

  const hotkeyInputHandlers = {
    onKeyDown:
      (setter: (accel: string) => void) =>
      (e: React.KeyboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const accel = buildAcceleratorFromEvent(e);
        if (accel) setter(accel);
      },
  } as const;

  const globalCaptureSetterRef = React.useRef<null | ((accel: string) => void)>(
    null,
  );
  const globalKeyHandler = React.useCallback(
    (ev: KeyboardEvent) => {
      if (!globalCaptureSetterRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      const accel = buildAcceleratorFromEvent(ev);
      if (!accel) return;
      try {
        globalCaptureSetterRef.current(accel);
      } finally {
        globalCaptureSetterRef.current = null;
        window.removeEventListener('keydown', globalKeyHandler, true);
        (document.activeElement as HTMLElement | null)?.blur?.();
      }
    },
    [buildAcceleratorFromEvent],
  );
  const startGlobalCapture = React.useCallback(
    (setter: (accel: string) => void) => () => {
      globalCaptureSetterRef.current = setter;
      window.addEventListener('keydown', globalKeyHandler, true);
    },
    [globalKeyHandler],
  );

  const handleDelayHotkeyChange = useCallback(
    async (field: 'hotkeyDelay3' | 'hotkeyDelay5', value: string) => {
      const nextCapture = {
        ...preferences.capture,
        [field]: value || null,
      } as typeof preferences.capture;
      await onUpdate({ capture: nextCapture });
    },
    [preferences, onUpdate],
  );

  const handleSaveLocationChange = useCallback(
    async (defaultSaveLocation: string) => {
      await onUpdate({
        capture: {
          ...preferences.capture,
          defaultSaveLocation,
        },
      });
    },
    [preferences, onUpdate],
  );

  const handleAutoCopyChange = useCallback(
    async (autoCopyToClipboard: boolean) => {
      await onUpdate({
        capture: {
          ...preferences.capture,
          autoCopyToClipboard,
        },
      });
    },
    [preferences, onUpdate],
  );

  const handleFormatChange = useCallback(
    async (defaultFormat: 'png' | 'jpg') => {
      await onUpdate({
        capture: {
          ...preferences.capture,
          defaultFormat,
        },
      });
    },
    [preferences.capture, onUpdate],
  );

  const handleStartupChange = useCallback(
    async (launchAtStartup: boolean) => {
      await onUpdate({
        system: {
          ...preferences.system,
          launchAtStartup,
        },
      });
    },
    [preferences.system, onUpdate],
  );

  const handleTrayChange = useCallback(
    async (showInTray: boolean) => {
      await onUpdate({
        system: {
          ...preferences.system,
          showInTray,
        },
      });
    },
    [preferences.system, onUpdate],
  );

  const selectFolder = useCallback(async () => {
    try {
      // Use Electron's native folder dialog
      const api = window?.electron?.ipcRenderer;
      if (!api) return;

      const result = await api.invoke('select-folder', {
        defaultPath: preferences.capture.defaultSaveLocation,
      });

      if (!result.canceled && result.filePath) {
        await handleSaveLocationChange(result.filePath);
      }
    } catch (error) {
      logger.error('Failed to select folder', error);
    }
  }, [preferences.capture.defaultSaveLocation, handleSaveLocationChange]);

  const formatOptions = [
    { value: 'png', label: 'PNG (Lossless)' },
    { value: 'jpg', label: 'JPG (Compressed)' },
  ];

  return (
    <div style={sectionStyles}>
      {/* Screenshot Capture */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Screenshot Capture</h3>

        <div style={{ width: '100%' }}>
          <div style={labelStyles} id="hotkey-label">
            Global Hotkey
          </div>
          <p style={descriptionStyles}>
            Keyboard shortcut to trigger screenshot capture
          </p>
          <Input
            aria-labelledby="hotkey-label"
            type="text"
            value={preferences.capture.hotkey}
            onChange={() => {}}
            onFocus={startGlobalCapture((accel) => handleHotkeyChange(accel))}
            onKeyDown={hotkeyInputHandlers.onKeyDown((accel) => {
              if (accel) handleHotkeyChange(accel);
            })}
            placeholder="Click then press shortcut"
            variant="filled"
            size="md"
            style={{ width: '100%', maxWidth: '360px' }}
            readOnly
          />
        </div>

        <div style={{ width: '100%' }}>
          <div style={labelStyles} id="delay-hotkey-label">
            Delayed Capture Hotkeys
          </div>
          <p style={descriptionStyles}>
            Optional shortcuts for delayed capture. Leave blank to disable.
          </p>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: spacing[3],
              width: '100%',
            }}
          >
            <div>
              <Input
                aria-labelledby="delay-hotkey-label"
                type="text"
                value={preferences.capture.hotkeyDelay3 || ''}
                onChange={() => {}}
                onFocus={startGlobalCapture((accel) =>
                  handleDelayHotkeyChange('hotkeyDelay3', accel),
                )}
                onKeyDown={hotkeyInputHandlers.onKeyDown((accel) => {
                  if (accel) handleDelayHotkeyChange('hotkeyDelay3', accel);
                })}
                placeholder="Click then press shortcut (3s)"
                variant="filled"
                size="md"
                style={{ width: '100%' }}
                readOnly
              />
            </div>
            <div>
              <Input
                aria-labelledby="delay-hotkey-label"
                type="text"
                value={preferences.capture.hotkeyDelay5 || ''}
                onChange={() => {}}
                onFocus={startGlobalCapture((accel) =>
                  handleDelayHotkeyChange('hotkeyDelay5', accel),
                )}
                onKeyDown={hotkeyInputHandlers.onKeyDown((accel) => {
                  if (accel) handleDelayHotkeyChange('hotkeyDelay5', accel);
                })}
                placeholder="Click then press shortcut (5s)"
                variant="filled"
                size="md"
                style={{ width: '100%' }}
                readOnly
              />
            </div>
            <div>
              <Input
                aria-labelledby="delay-hotkey-label"
                type="text"
                value={preferences.capture.hotkeyRecapture || ''}
                onChange={() => {}}
                onFocus={startGlobalCapture((accel) =>
                  onUpdate({
                    capture: {
                      ...preferences.capture,
                      hotkeyRecapture: accel,
                    },
                  }),
                )}
                onKeyDown={hotkeyInputHandlers.onKeyDown((accel) => {
                  if (!accel) return;
                  onUpdate({
                    capture: {
                      ...preferences.capture,
                      hotkeyRecapture: accel,
                    },
                  });
                })}
                placeholder="Click then press shortcut (Re-capture last area)"
                variant="filled"
                size="md"
                style={{ width: '100%' }}
                readOnly
              />
            </div>
          </div>
        </div>

        <div>
          <div style={labelStyles} id="save-location-label">
            Default Save Location
          </div>
          <p style={descriptionStyles}>
            Where screenshots will be saved by default
          </p>
          <div style={fileInputStyles}>
            <Input
              aria-labelledby="save-location-label"
              type="text"
              value={preferences.capture.defaultSaveLocation}
              onChange={(e) => handleSaveLocationChange(e.target.value)}
              variant="filled"
              size="md"
              style={{ flex: 1 }}
              readOnly
            />
            <button
              type="button"
              style={buttonStyles}
              onClick={selectFolder}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = colors.surface.hover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = colors.surface.default;
              }}
            >
              Browse...
            </button>
          </div>
        </div>

        <div>
          <div style={labelStyles} id="format-label">
            Default Format
          </div>
          <p style={descriptionStyles}>
            Default file format for saved screenshots
          </p>
          <Select
            aria-labelledby="format-label"
            value={preferences.capture.defaultFormat}
            onChange={(e) =>
              handleFormatChange(e.target.value as 'png' | 'jpg')
            }
            options={formatOptions}
            variant="filled"
            size="md"
            style={{ maxWidth: '250px' }}
          />
        </div>

        <label htmlFor="auto-copy" style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="auto-copy"
            checked={preferences.capture.autoCopyToClipboard}
            onChange={(e) => handleAutoCopyChange(e.target.checked)}
            style={checkboxStyles}
          />
          <span
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Auto-copy screenshots to clipboard
          </span>
        </label>
      </div>

      {/* System Integration */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>System Integration</h3>

        <label htmlFor="launch-startup" style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="launch-startup"
            checked={preferences.system.launchAtStartup}
            onChange={(e) => handleStartupChange(e.target.checked)}
            style={checkboxStyles}
          />
          <span
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Launch X-Shot at system startup
          </span>
        </label>

        <label htmlFor="show-tray" style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="show-tray"
            checked={preferences.system.showInTray}
            onChange={(e) => handleTrayChange(e.target.checked)}
            style={checkboxStyles}
          />
          <span
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Show icon in system tray
          </span>
        </label>
      </div>
    </div>
  );
}

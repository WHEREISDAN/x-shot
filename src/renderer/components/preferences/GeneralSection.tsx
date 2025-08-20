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

  const handleSaveLocationChange = useCallback(
    async (defaultSaveLocation: string) => {
      await onUpdate({
        capture: {
          ...preferences.capture,
          defaultSaveLocation,
        },
      });
    },
    [preferences.capture, onUpdate],
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
    [preferences.capture, onUpdate],
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

        <div>
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
            onChange={(e) => handleHotkeyChange(e.target.value)}
            placeholder="CommandOrControl+Shift+1"
            variant="filled"
            size="md"
            style={{ maxWidth: '300px' }}
          />
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

        <div style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="auto-copy"
            checked={preferences.capture.autoCopyToClipboard}
            onChange={(e) => handleAutoCopyChange(e.target.checked)}
            style={checkboxStyles}
          />
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label
            htmlFor="auto-copy"
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Auto-copy screenshots to clipboard
          </label>
        </div>
      </div>

      {/* System Integration */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>System Integration</h3>

        <div style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="launch-startup"
            checked={preferences.system.launchAtStartup}
            onChange={(e) => handleStartupChange(e.target.checked)}
            style={checkboxStyles}
          />
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label
            htmlFor="launch-startup"
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Launch X-Shot at system startup
          </label>
        </div>

        <div style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="show-tray"
            checked={preferences.system.showInTray}
            onChange={(e) => handleTrayChange(e.target.checked)}
            style={checkboxStyles}
          />
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label
            htmlFor="show-tray"
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Show icon in system tray
          </label>
        </div>
      </div>
    </div>
  );
}

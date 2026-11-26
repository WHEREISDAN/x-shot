import { useCallback, useEffect, useState } from 'react';
import type { AppPreferences, WindowState } from '../../../shared/ipc-types';
import type { UpdatePreferences } from '../../hooks/use-preferences';
import { Button, Select, Switch } from '../../design-system';
import { createRendererLogger } from '../../utils/logger';
import HotkeyRecorder from './HotkeyRecorder';
import { tildePath, useHomeFolder } from './home-folder';
import SettingsCard from './SettingsCard';
import SettingsRow, { descriptionId, PathText } from './SettingsRow';
import controls from './PreferenceControls.module.css';

function initialPlatform(): WindowState['platform'] | null {
  const fromPreload = window?.electron?.platform;
  if (fromPreload) return fromPreload;
  if (typeof navigator !== 'undefined' && /linux/i.test(navigator.platform)) {
    return 'linux';
  }
  return null;
}

function usePlatform(): WindowState['platform'] | null {
  const [platform, setPlatform] = useState<WindowState['platform'] | null>(
    initialPlatform,
  );
  useEffect(() => {
    if (platform) return () => {};
    const api = window?.electron?.windowControls;
    if (!api) return () => {};
    let active = true;
    api
      .getState()
      .then((state) => {
        if (active && state?.platform) setPlatform(state.platform);
        return state;
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [platform]);
  return platform;
}

const logger = createRendererLogger('preferences-general');

type OptionalHotkey = 'hotkeyDelay3' | 'hotkeyDelay5' | 'hotkeyRecapture';

const OPTIONAL_HOTKEYS: ReadonlyArray<[OptionalHotkey, string]> = [
  ['hotkeyDelay3', 'Delayed Capture (3s)'],
  ['hotkeyDelay5', 'Delayed Capture (5s)'],
  ['hotkeyRecapture', 'Re-capture Last Area'],
];

const FORMAT_OPTIONS = [
  { value: 'png', label: 'PNG (Lossless)' },
  { value: 'jpg', label: 'JPG (Compressed)' },
];

interface GeneralSectionProps {
  preferences: AppPreferences;
  onUpdate: UpdatePreferences;
}

export default function GeneralSection({
  preferences,
  onUpdate,
}: GeneralSectionProps) {
  const { capture, system } = preferences;
  const home = useHomeFolder();
  const launchAtStartupSupported = usePlatform() !== 'linux';

  const handleHotkeyChange = useCallback(
    (hotkey: string) => onUpdate({ capture: { hotkey } }),
    [onUpdate],
  );

  const handleOptionalHotkeyChange = useCallback(
    (field: OptionalHotkey, value: string | null) =>
      onUpdate({ capture: { [field]: value || null } }),
    [onUpdate],
  );

  const selectFolder = useCallback(async () => {
    try {
      const api = window?.electron?.ipcRenderer;
      if (!api) return;
      const result = await api.invoke('select-folder', {
        defaultPath: capture.defaultSaveLocation,
      });
      if (!result.canceled && result.filePath) {
        await onUpdate({ capture: { defaultSaveLocation: result.filePath } });
      }
    } catch (error) {
      logger.error('Failed to select folder', error);
    }
  }, [capture.defaultSaveLocation, onUpdate]);

  return (
    <>
      <SettingsCard
        label="Capture"
        note="Click a shortcut to record a new one. Escape cancels; Backspace clears an optional shortcut."
      >
        <SettingsRow
          labelId="hotkey-label"
          label="Global Hotkey"
          description="Keyboard shortcut to trigger screenshot capture"
        >
          <HotkeyRecorder
            labelId="hotkey-label"
            value={capture.hotkey}
            onRecord={handleHotkeyChange}
          />
        </SettingsRow>
        {OPTIONAL_HOTKEYS.map(([field, label]) => (
          <SettingsRow key={field} labelId={`${field}-label`} label={label}>
            <HotkeyRecorder
              labelId={`${field}-label`}
              value={capture[field] ?? null}
              onRecord={(accelerator) =>
                handleOptionalHotkeyChange(field, accelerator)
              }
              onClear={() => handleOptionalHotkeyChange(field, null)}
            />
          </SettingsRow>
        ))}
      </SettingsCard>

      <SettingsCard label="Saving">
        <SettingsRow
          labelId="save-location-label"
          label="Default Save Location"
          description={
            <PathText
              path={capture.defaultSaveLocation}
              display={tildePath(capture.defaultSaveLocation, home)}
            />
          }
        >
          <Button size="sm" onClick={selectFolder}>
            Browse…
          </Button>
        </SettingsRow>
        <SettingsRow
          labelId="format-label"
          label="Default Format"
          description="Default file format for saved screenshots"
        >
          <Select
            aria-labelledby="format-label"
            value={capture.defaultFormat}
            onChange={(e) =>
              onUpdate({
                capture: { defaultFormat: e.target.value as 'png' | 'jpg' },
              })
            }
            options={FORMAT_OPTIONS}
            className={controls.select}
          />
        </SettingsRow>
        <SettingsRow
          labelId="auto-copy-label"
          label="Auto-copy screenshots to clipboard"
        >
          <Switch
            aria-labelledby="auto-copy-label"
            checked={capture.autoCopyToClipboard}
            onChange={(autoCopyToClipboard) =>
              onUpdate({ capture: { autoCopyToClipboard } })
            }
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard label="System">
        <SettingsRow
          labelId="launch-startup-label"
          label="Launch X-Shot at system startup"
          description={
            launchAtStartupSupported
              ? undefined
              : 'Not supported on Linux. Configure autostart in your desktop environment.'
          }
        >
          <Switch
            aria-labelledby="launch-startup-label"
            aria-describedby={
              launchAtStartupSupported
                ? undefined
                : descriptionId('launch-startup-label')
            }
            checked={launchAtStartupSupported ? system.launchAtStartup : false}
            disabled={!launchAtStartupSupported}
            onChange={(launchAtStartup) =>
              onUpdate({ system: { launchAtStartup } })
            }
          />
        </SettingsRow>
        <SettingsRow labelId="show-tray-label" label="Show icon in system tray">
          <Switch
            aria-labelledby="show-tray-label"
            checked={system.showInTray}
            onChange={(showInTray) => onUpdate({ system: { showInTray } })}
          />
        </SettingsRow>
      </SettingsCard>
    </>
  );
}

import type { AppPreferences } from '../../../shared/ipc-types';
import type { UpdatePreferences } from '../../hooks/use-preferences';
import { formatFilename } from '../../../shared/export-filename';
import { Input, Select, Switch } from '../../design-system';
import SettingsCard from './SettingsCard';
import SettingsRow, { descriptionId } from './SettingsRow';
import controls from './PreferenceControls.module.css';

const SCALE_OPTIONS = [
  { value: 1, label: '1x (Original)' },
  { value: 2, label: '2x (High DPI)' },
  { value: 3, label: '3x (Ultra High DPI)' },
  { value: 4, label: '4x (Maximum)' },
];

interface ExportSectionProps {
  preferences: AppPreferences;
  onUpdate: UpdatePreferences;
  /** Saves debounced changes now. */
  onFlush: () => void;
}

export default function ExportSection({
  preferences,
  onUpdate,
  onFlush,
}: ExportSectionProps) {
  const { export: exportPrefs } = preferences;
  const example = `${formatFilename(exportPrefs.filenamePattern, new Date())}.png`;

  return (
    <>
      <SettingsCard
        label="File Naming"
        note={
          <>
            Example: <span className={controls.mono}>{example}</span>
          </>
        }
      >
        <SettingsRow
          labelId="filename-pattern-label"
          label="Filename Pattern"
          description="Variables: $TIMESTAMP, $DATE, $TIME"
        >
          <Input
            aria-labelledby="filename-pattern-label"
            type="text"
            mono
            value={exportPrefs.filenamePattern}
            onChange={(e) =>
              onUpdate(
                { export: { filenamePattern: e.target.value } },
                { debounce: true },
              )
            }
            onBlur={onFlush}
            placeholder="X-Shot_$TIMESTAMP"
            className={controls.field}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard label="Save Behavior">
        <SettingsRow
          labelId="auto-save-label"
          label="Auto-save screenshots without showing save dialog"
          description="Saves to the default location without asking; when off, a save dialog appears each time."
        >
          <Switch
            aria-labelledby="auto-save-label"
            aria-describedby={descriptionId('auto-save-label')}
            checked={exportPrefs.autoSave}
            onChange={(autoSave) => onUpdate({ export: { autoSave } })}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard label="Export Quality">
        <SettingsRow
          labelId="export-scale-label"
          label="Default Export Scale"
          description="Default scale multiplier for exported images"
        >
          <Select
            aria-labelledby="export-scale-label"
            value={exportPrefs.defaultScale}
            onChange={(e) =>
              onUpdate({ export: { defaultScale: Number(e.target.value) } })
            }
            options={SCALE_OPTIONS}
            className={controls.select}
          />
        </SettingsRow>
      </SettingsCard>
    </>
  );
}

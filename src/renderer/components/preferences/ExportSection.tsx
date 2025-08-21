import React, { useCallback } from 'react';
import type { AppPreferences } from '../../../shared/ipc-types';
import { Input, Select } from '../../design-system';
import { colors, spacing, typography } from '../../design-system/tokens';

interface ExportSectionProps {
  preferences: AppPreferences;
  onUpdate: (updates: Partial<AppPreferences>) => Promise<boolean>;
}

export default function ExportSection({
  preferences,
  onUpdate,
}: ExportSectionProps) {
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

  const exampleStyles: React.CSSProperties = {
    padding: spacing[3],
    background: colors.background.secondary,
    borderRadius: '4px',
    fontSize: typography.fontSize.sm,
    fontFamily: 'monospace',
    color: colors.text.secondary,
    marginTop: spacing[2],
  };

  const handleFilenamePatternChange = useCallback(
    async (filenamePattern: string) => {
      await onUpdate({
        export: {
          ...preferences.export,
          filenamePattern,
        },
      });
    },
    [preferences.export, onUpdate],
  );

  const handleAutoSaveChange = useCallback(
    async (autoSave: boolean) => {
      await onUpdate({
        export: {
          ...preferences.export,
          autoSave,
        },
      });
    },
    [preferences.export, onUpdate],
  );

  const handleDefaultScaleChange = useCallback(
    async (defaultScale: number) => {
      await onUpdate({
        export: {
          ...preferences.export,
          defaultScale,
        },
      });
    },
    [preferences.export, onUpdate],
  );

  const scaleOptions = [
    { value: 1, label: '1x (Original)' },
    { value: 2, label: '2x (High DPI)' },
    { value: 3, label: '3x (Ultra High DPI)' },
    { value: 4, label: '4x (Maximum)' },
  ];

  const generateExampleFilename = () => {
    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, '-')
      .replace('T', '_')
      .slice(0, 19);

    return preferences.export.filenamePattern
      .replace('$TIMESTAMP', timestamp)
      .replace('$DATE', new Date().toISOString().slice(0, 10))
      .replace(
        '$TIME',
        new Date().toTimeString().slice(0, 8).replace(/:/g, '-'),
      );
  };

  return (
    <div style={sectionStyles}>
      {/* File Naming */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>File Naming</h3>

        <div>
          <div style={labelStyles} id="filename-pattern-label">
            Filename Pattern
          </div>
          <p style={descriptionStyles}>
            Pattern for naming saved screenshots. Available variables:
            $TIMESTAMP, $DATE, $TIME
          </p>
          <Input
            aria-labelledby="filename-pattern-label"
            type="text"
            value={preferences.export.filenamePattern}
            onChange={(e) => handleFilenamePatternChange(e.target.value)}
            placeholder="X-Shot_$TIMESTAMP"
            variant="filled"
            size="md"
            style={{ maxWidth: '400px' }}
          />
          <div style={exampleStyles}>
            Example: {generateExampleFilename()}.png
          </div>
        </div>
      </div>

      {/* Save Behavior */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Save Behavior</h3>

        <label htmlFor="auto-save" style={checkboxContainerStyles}>
          <input
            type="checkbox"
            id="auto-save"
            checked={preferences.export.autoSave}
            onChange={(e) => handleAutoSaveChange(e.target.checked)}
            style={checkboxStyles}
          />
          <span
            style={{
              fontSize: typography.fontSize.base,
              color: colors.text.primary,
            }}
          >
            Auto-save screenshots without showing save dialog
          </span>
        </label>
        <p style={descriptionStyles}>
          When enabled, screenshots will be automatically saved to the default
          location without prompting. When disabled, a save dialog will appear
          each time.
        </p>
      </div>

      {/* Export Quality */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Export Quality</h3>

        <div>
          <div style={labelStyles} id="export-scale-label">
            Default Export Scale
          </div>
          <p style={descriptionStyles}>
            Default scale multiplier for exported images
          </p>
          <Select
            aria-labelledby="export-scale-label"
            value={preferences.export.defaultScale}
            onChange={(e) => handleDefaultScaleChange(Number(e.target.value))}
            options={scaleOptions}
            variant="filled"
            size="md"
            style={{ maxWidth: '250px' }}
          />
        </div>
      </div>
    </div>
  );
}

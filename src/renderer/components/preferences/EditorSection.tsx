import React, { useCallback } from 'react';
import type { AppPreferences } from '../../../shared/ipc-types';
import { Input } from '../../design-system';
import { ColorSwatch } from '../editor/editor-tools';
import { colors, spacing, typography } from '../../design-system/tokens';

interface EditorSectionProps {
  preferences: AppPreferences;
  onUpdate: (updates: Partial<AppPreferences>) => Promise<boolean>;
}

const COLOR_PRESETS = [
  '#ef4444', // red
  '#f59e0b', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#000000', // black
  '#ffffff', // white
];

export default function EditorSection({
  preferences,
  onUpdate,
}: EditorSectionProps) {
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

  const colorGridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))',
    gap: spacing[2],
    maxWidth: '300px',
  };

  const rangeContainerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    maxWidth: '300px',
  };

  const rangeStyles: React.CSSProperties = {
    width: '100%',
    accentColor: colors.primary.DEFAULT,
  };

  const rangeValueStyles: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    textAlign: 'right' as const,
  };

  const handleStrokeColorChange = useCallback(
    async (defaultStrokeColor: string) => {
      await onUpdate({
        editor: {
          ...preferences.editor,
          defaultStrokeColor,
        },
      });
    },
    [preferences.editor, onUpdate],
  );

  const handleFillColorChange = useCallback(
    async (defaultFillColor: string) => {
      await onUpdate({
        editor: {
          ...preferences.editor,
          defaultFillColor,
        },
      });
    },
    [preferences.editor, onUpdate],
  );

  const handleStrokeWidthChange = useCallback(
    async (defaultStrokeWidth: number) => {
      await onUpdate({
        editor: {
          ...preferences.editor,
          defaultStrokeWidth,
        },
      });
    },
    [preferences.editor, onUpdate],
  );

  const handleTextSizeChange = useCallback(
    async (defaultTextSize: number) => {
      await onUpdate({
        editor: {
          ...preferences.editor,
          defaultTextSize,
        },
      });
    },
    [preferences.editor, onUpdate],
  );

  const handleCustomStrokeColor = useCallback(
    async (color: string) => {
      if (/^#[0-9A-F]{6}$/i.test(color)) {
        await handleStrokeColorChange(color);
      }
    },
    [handleStrokeColorChange],
  );

  const handleCustomFillColor = useCallback(
    async (color: string) => {
      if (/^#[0-9A-F]{6}$/i.test(color) || color === 'transparent') {
        await handleFillColorChange(color);
      }
    },
    [handleFillColorChange],
  );

  return (
    <div style={sectionStyles}>
      {/* Default Colors */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Default Colors</h3>

        <div>
          <div style={labelStyles} id="stroke-color-label">
            Stroke Color
          </div>
          <p style={descriptionStyles}>
            Default color for drawing tools (pen, arrows, shapes)
          </p>
          <div
            style={colorGridStyles}
            role="radiogroup"
            aria-labelledby="stroke-color-label"
          >
            {COLOR_PRESETS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={preferences.editor.defaultStrokeColor === color}
                onClick={() => handleStrokeColorChange(color)}
                size="md"
              />
            ))}
          </div>
          <div
            style={{
              marginTop: spacing[3],
              display: 'flex',
              gap: spacing[2],
              alignItems: 'center',
            }}
          >
            <Input
              id="stroke-color-section"
              type="color"
              value={preferences.editor.defaultStrokeColor}
              onChange={(e) => handleStrokeColorChange(e.target.value)}
              style={{ width: '40px', height: '32px', padding: '0' }}
            />
            <Input
              type="text"
              value={preferences.editor.defaultStrokeColor}
              onChange={(e) => handleCustomStrokeColor(e.target.value)}
              placeholder="#ff0000"
              variant="filled"
              size="sm"
              style={{ width: '100px' }}
            />
          </div>
        </div>

        <div>
          <div style={labelStyles} id="fill-color-label">
            Fill Color
          </div>
          <p style={descriptionStyles}>
            Default fill color for shapes (rectangles, ellipses)
          </p>
          <div
            style={colorGridStyles}
            role="radiogroup"
            aria-labelledby="fill-color-label"
          >
            <ColorSwatch
              color="transparent"
              selected={preferences.editor.defaultFillColor === 'transparent'}
              onClick={() => handleFillColorChange('transparent')}
              size="md"
            />
            {COLOR_PRESETS.map((color) => (
              <ColorSwatch
                key={color}
                color={color}
                selected={preferences.editor.defaultFillColor === color}
                onClick={() => handleFillColorChange(color)}
                size="md"
              />
            ))}
          </div>
          <div
            style={{
              marginTop: spacing[3],
              display: 'flex',
              gap: spacing[2],
              alignItems: 'center',
            }}
          >
            <Input
              type="color"
              value={
                preferences.editor.defaultFillColor === 'transparent'
                  ? '#ffffff'
                  : preferences.editor.defaultFillColor
              }
              onChange={(e) => handleFillColorChange(e.target.value)}
              style={{ width: '40px', height: '32px', padding: '0' }}
            />
            <Input
              type="text"
              value={preferences.editor.defaultFillColor}
              onChange={(e) => handleCustomFillColor(e.target.value)}
              placeholder="transparent or #ff0000"
              variant="filled"
              size="sm"
              style={{ width: '140px' }}
            />
          </div>
        </div>
      </div>

      {/* Default Sizes */}
      <div style={groupStyles}>
        <h3 style={labelStyles}>Default Sizes</h3>

        <div>
          <div style={labelStyles} id="stroke-width-label">
            Stroke Width
          </div>
          <p style={descriptionStyles}>
            Default thickness for drawing tools and shape outlines
          </p>
          <div style={rangeContainerStyles}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                }}
              >
                1px
              </span>
              <span style={rangeValueStyles}>
                {preferences.editor.defaultStrokeWidth}px
              </span>
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                }}
              >
                20px
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={20}
              value={preferences.editor.defaultStrokeWidth}
              onChange={(e) => handleStrokeWidthChange(Number(e.target.value))}
              style={rangeStyles}
              aria-labelledby="stroke-width-label"
            />
          </div>
        </div>

        <div>
          <div style={labelStyles} id="text-size-label">
            Text Size
          </div>
          <p style={descriptionStyles}>Default font size for text tool</p>
          <div style={rangeContainerStyles}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                }}
              >
                8px
              </span>
              <span style={rangeValueStyles}>
                {preferences.editor.defaultTextSize}px
              </span>
              <span
                style={{
                  fontSize: typography.fontSize.sm,
                  color: colors.text.secondary,
                }}
              >
                72px
              </span>
            </div>
            <input
              type="range"
              min={8}
              max={72}
              value={preferences.editor.defaultTextSize}
              onChange={(e) => handleTextSizeChange(Number(e.target.value))}
              style={rangeStyles}
              aria-labelledby="text-size-label"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

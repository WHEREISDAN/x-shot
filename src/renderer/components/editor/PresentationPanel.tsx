import React from 'react';
import type { PresentationSettings } from '../../hooks/use-presentation-state';
import { presets, toCssGradient } from './gradient-presets';
import { GlassPanel, Input, Select } from '../../design-system';
import {
  colors,
  spacing,
  borderRadius,
  typography,
} from '../../design-system/tokens';

interface PresentationPanelProps {
  settings: PresentationSettings;
  onChange: {
    setPadding: (n: number) => void;
    setInset: (n: number) => void;
    setRadius: (n: number) => void;
    setAspectPreset: (a: any) => void;
    setCustomAspect: (w: number, h: number) => void;
    setExportScale: (n: number) => void;
    setShadow: (s: Partial<PresentationSettings['shadow']>) => void;
    setGradient: (g: Partial<PresentationSettings['gradient']>) => void;
    setBorderColor: (c: string) => void;
  };
}

export default function PresentationPanel({
  settings,
  onChange,
}: PresentationPanelProps) {
  const aspectPresets = [
    { value: 'auto', label: 'Auto' },
    { value: '1:1', label: '1:1' },
    { value: '4:3', label: '4:3' },
    { value: '3:2', label: '3:2' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: 'custom', label: 'Custom' },
  ];

  const exportScaleOptions = [
    { value: 1, label: '1x' },
    { value: 2, label: '2x' },
    { value: 3, label: '3x' },
    { value: 4, label: '4x' },
  ];

  const containerStyles: React.CSSProperties = {
    position: 'absolute',
    right: spacing[4],
    top: '150px',
    width: '280px',
    zIndex: 20,
  };

  const sectionStyles: React.CSSProperties = {
    marginBottom: spacing[3],
  };

  const sectionTitleStyles: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    opacity: 0.8,
    marginBottom: spacing[2],
    color: colors.text.secondary,
  };

  const gridStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: spacing[2],
  };

  const gradientButtonStyles: React.CSSProperties = {
    height: '36px',
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.border.muted}`,
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  };

  const colorInputGroupStyles: React.CSSProperties = {
    display: 'flex',
    gap: spacing[2],
  };

  const colorInputStyles: React.CSSProperties = {
    width: '40px',
    height: '28px',
    padding: '0',
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.emphasis}`,
    background: 'transparent',
    cursor: 'pointer',
  };

  const rangeContainerStyles: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: spacing[2],
  };

  const rangeFullWidthStyles: React.CSSProperties = {
    gridColumn: '1 / span 2',
  };

  const rangeLabelStyles: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
  };

  const rangeInputStyles: React.CSSProperties = {
    width: '100%',
    accentColor: colors.primary.DEFAULT,
  };

  const checkboxLabelStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    fontSize: typography.fontSize.sm,
    color: colors.text.secondary,
    cursor: 'pointer',
  };

  const flexRowStyles: React.CSSProperties = {
    display: 'flex',
    gap: spacing[2],
  };

  return (
    <div style={containerStyles}>
      <GlassPanel title="Presentation" size="md" padding={3}>
        <div style={sectionStyles}>
          <div style={sectionTitleStyles}>Background</div>
          <div style={gridStyles}>
            {presets.map((g, i) => (
              <button
                type="button"
                key={`${g.kind}-${g.angleDeg}-${g.stops.map((s) => s.color).join('-')}`}
                onClick={() => onChange.setGradient(g)}
                aria-label={`Gradient ${i + 1}`}
                style={{
                  ...gradientButtonStyles,
                  background: toCssGradient(g, 120, 36),
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              />
            ))}
          </div>
        </div>

        <div style={sectionStyles}>
          <div style={sectionTitleStyles}>Border color (inset area)</div>
          <div style={colorInputGroupStyles}>
            <input
              type="color"
              aria-label="Border color"
              value={settings.borderColor}
              onChange={(e) => onChange.setBorderColor(e.target.value)}
              style={colorInputStyles}
            />
            <Input
              type="text"
              value={settings.borderColor}
              onChange={(e) => onChange.setBorderColor(e.target.value)}
              variant="filled"
              size="sm"
              fullWidth
            />
          </div>
        </div>

        <div style={sectionStyles}>
          <div style={rangeContainerStyles}>
            <label htmlFor="padding-range" style={rangeLabelStyles}>
              Padding
              <input
                id="padding-range"
                type="range"
                min={0}
                max={400}
                value={settings.padding}
                onChange={(e) => onChange.setPadding(Number(e.target.value))}
                style={rangeInputStyles}
              />
            </label>
            <label htmlFor="inset-range" style={rangeLabelStyles}>
              Inset
              <input
                id="inset-range"
                type="range"
                min={0}
                max={200}
                value={settings.inset}
                onChange={(e) => onChange.setInset(Number(e.target.value))}
                style={rangeInputStyles}
              />
            </label>
            <label
              htmlFor="radius-range"
              style={{ ...rangeLabelStyles, ...rangeFullWidthStyles }}
            >
              Radius
              <input
                id="radius-range"
                type="range"
                min={0}
                max={200}
                value={settings.radius}
                onChange={(e) => onChange.setRadius(Number(e.target.value))}
                style={rangeInputStyles}
              />
            </label>
          </div>
        </div>

        <div style={sectionStyles}>
          <div style={sectionTitleStyles}>Shadow</div>
          <label htmlFor="shadow-enabled" style={checkboxLabelStyles}>
            <input
              id="shadow-enabled"
              type="checkbox"
              checked={settings.shadow.enabled}
              onChange={(e) =>
                onChange.setShadow({ enabled: e.target.checked })
              }
            />
            Enable
          </label>
          <div
            style={{
              ...rangeContainerStyles,
              opacity: settings.shadow.enabled ? 1 : 0.6,
              marginTop: spacing[2],
            }}
          >
            <label htmlFor="shadow-x" style={rangeLabelStyles}>
              Offset X
              <input
                id="shadow-x"
                type="range"
                min={-64}
                max={64}
                value={settings.shadow.x}
                onChange={(e) =>
                  onChange.setShadow({ x: Number(e.target.value) })
                }
                style={rangeInputStyles}
                disabled={!settings.shadow.enabled}
              />
            </label>
            <label htmlFor="shadow-y" style={rangeLabelStyles}>
              Offset Y
              <input
                id="shadow-y"
                type="range"
                min={-64}
                max={64}
                value={settings.shadow.y}
                onChange={(e) =>
                  onChange.setShadow({ y: Number(e.target.value) })
                }
                style={rangeInputStyles}
                disabled={!settings.shadow.enabled}
              />
            </label>
            <label htmlFor="shadow-blur" style={rangeLabelStyles}>
              Blur
              <input
                id="shadow-blur"
                type="range"
                min={0}
                max={296}
                value={settings.shadow.blur}
                onChange={(e) =>
                  onChange.setShadow({ blur: Number(e.target.value) })
                }
                style={rangeInputStyles}
                disabled={!settings.shadow.enabled}
              />
            </label>
            <label htmlFor="shadow-spread" style={rangeLabelStyles}>
              Spread
              <input
                id="shadow-spread"
                type="range"
                min={0}
                max={264}
                value={settings.shadow.spread}
                onChange={(e) =>
                  onChange.setShadow({ spread: Number(e.target.value) })
                }
                style={rangeInputStyles}
                disabled={!settings.shadow.enabled}
              />
            </label>
          </div>
        </div>

        <div style={sectionStyles}>
          <div style={sectionTitleStyles}>Ratio / Size</div>
          <div style={flexRowStyles}>
            <Select
              size="sm"
              variant="filled"
              value={settings.aspect.preset}
              onChange={(e) => onChange.setAspectPreset(e.target.value as any)}
              options={aspectPresets}
              fullWidth
            />
            <Select
              size="sm"
              variant="filled"
              value={settings.exportScale}
              onChange={(e) => onChange.setExportScale(Number(e.target.value))}
              options={exportScaleOptions}
              style={{ width: '72px' }}
            />
          </div>
          {settings.aspect.preset === 'custom' && (
            <div style={{ ...flexRowStyles, marginTop: spacing[2] }}>
              <Input
                type="number"
                min={1}
                value={settings.aspect.custom?.w ?? ''}
                onChange={(e) =>
                  onChange.setCustomAspect(
                    Number(e.target.value || 1),
                    settings.aspect.custom?.h ?? 1,
                  )
                }
                placeholder="W"
                variant="filled"
                size="sm"
                fullWidth
              />
              <Input
                type="number"
                min={1}
                value={settings.aspect.custom?.h ?? ''}
                onChange={(e) =>
                  onChange.setCustomAspect(
                    settings.aspect.custom?.w ?? 1,
                    Number(e.target.value || 1),
                  )
                }
                placeholder="H"
                variant="filled"
                size="sm"
                fullWidth
              />
            </div>
          )}
        </div>
      </GlassPanel>
    </div>
  );
}

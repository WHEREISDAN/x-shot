import React, { memo } from 'react';
import type { ToolType } from '../../hooks/use-editor-state';
import { ToolButton, ColorSwatch } from './editor-tools';
import { Select } from '../../design-system';
import {
  colors,
  spacing,
  borderRadius,
  zIndex,
} from '../../design-system/tokens';

interface BottomToolbarProps {
  activeTool: ToolType;
  setActiveTool: (t: ToolType) => void;
  strokeColor: string;
  setStrokeColor: (c: string) => void;
  strokeWidth: number;
  setStrokeWidth: (n: number) => void;
  textSize: number;
  setTextSize: (n: number) => void;
  showTextControls: boolean;
  showTextSelectLevel: boolean;
  textSelectLevel: 'word' | 'line' | 'paragraph';
  setTextSelectLevel: (lvl: 'word' | 'line' | 'paragraph') => void;
}

const BottomToolbar = memo(function BottomToolbar({
  activeTool,
  setActiveTool,
  strokeColor,
  setStrokeColor,
  strokeWidth,
  setStrokeWidth,
  textSize,
  setTextSize,
  showTextControls,
  showTextSelectLevel,
  textSelectLevel,
  setTextSelectLevel,
}: BottomToolbarProps) {
  const containerStyles: React.CSSProperties = {
    position: 'fixed',
    left: '50%',
    bottom: spacing[6],
    transform: 'translateX(-50%)',
    zIndex: zIndex.dropdown,
    background: colors.background.glass,
    borderRadius: borderRadius['4xl'],
    padding: `${spacing[3]} ${spacing[4]}`,
    display: 'flex',
    alignItems: 'center',
    gap: spacing[3],
    border: `1px solid ${colors.border.default}`,
    color: colors.text.primary,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
  };

  const dividerStyles: React.CSSProperties = {
    width: '1px',
    height: spacing[6],
    background: colors.border.muted,
    margin: `0 ${spacing[2]}`,
  };

  const colorGroupStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  };

  const controlGroupStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
  };

  const labelStyles: React.CSSProperties = {
    fontSize: '12px',
    opacity: 0.8,
    color: colors.text.secondary,
  };

  const strokeWidthOptions = [
    { value: 1, label: '1' },
    { value: 2, label: '2' },
    { value: 3, label: '3' },
    { value: 4, label: '4' },
    { value: 6, label: '6' },
    { value: 8, label: '8' },
    { value: 12, label: '12' },
  ];

  const textSizeOptions = [
    { value: 14, label: '14' },
    { value: 16, label: '16' },
    { value: 18, label: '18' },
    { value: 20, label: '20' },
    { value: 24, label: '24' },
    { value: 28, label: '28' },
  ];

  const textLevelOptions = [
    { value: 'word', label: 'Word' },
    { value: 'line', label: 'Line' },
    { value: 'paragraph', label: 'Paragraph' },
  ];

  return (
    <div style={containerStyles}>
      <ToolButton
        label="Select"
        active={activeTool === 'select'}
        onClick={() => setActiveTool('select')}
      />
      <ToolButton
        label="Pen"
        active={activeTool === 'pen'}
        onClick={() => setActiveTool('pen')}
      />
      <ToolButton
        label="Eyedropper"
        active={false}
        onClick={async () => {
          try {
            // Use EyeDropper API if available (Chromium 95+)
            // @ts-expect-error EyeDropper may exist in chromium runtime
            const EyeDropperCtor = (window as any).EyeDropper;
            if (EyeDropperCtor) {
              const ed = new EyeDropperCtor();
              const res = await ed.open();
              const color = (res?.sRGBHex as string) || '#ffffff';
              setStrokeColor(color);
            }
          } catch {
            // ignore
          }
        }}
      />
      <ToolButton
        label="Text Highlight"
        active={activeTool === 'text-select'}
        onClick={() => setActiveTool('text-select')}
      />
      <ToolButton
        label="Highlight"
        active={activeTool === 'highlighter'}
        onClick={() => setActiveTool('highlighter')}
      />
      <ToolButton
        label="Rect"
        active={activeTool === 'rect'}
        onClick={() => setActiveTool('rect')}
      />
      <ToolButton
        label="Ellipse"
        active={activeTool === 'ellipse'}
        onClick={() => setActiveTool('ellipse')}
      />
      <ToolButton
        label="Arrow"
        active={activeTool === 'arrow'}
        onClick={() => setActiveTool('arrow')}
      />
      <ToolButton
        label="Text"
        active={activeTool === 'text'}
        onClick={() => setActiveTool('text')}
      />

      <div style={dividerStyles} />

      <div style={colorGroupStyles}>
        <ColorSwatch
          color={colors.accent.red}
          selected={strokeColor === colors.accent.red}
          onClick={() => setStrokeColor(colors.accent.red)}
        />
        <ColorSwatch
          color={colors.accent.orange}
          selected={strokeColor === colors.accent.orange}
          onClick={() => setStrokeColor(colors.accent.orange)}
        />
        <ColorSwatch
          color={colors.accent.green}
          selected={strokeColor === colors.accent.green}
          onClick={() => setStrokeColor(colors.accent.green)}
        />
        <ColorSwatch
          color={colors.accent.blue}
          selected={strokeColor === colors.accent.blue}
          onClick={() => setStrokeColor(colors.accent.blue)}
        />
        <ColorSwatch
          color={colors.white}
          selected={strokeColor === colors.white}
          onClick={() => setStrokeColor(colors.white)}
        />
        <ColorSwatch
          color={colors.black}
          selected={strokeColor === colors.black}
          onClick={() => setStrokeColor(colors.black)}
        />
      </div>

      <div style={controlGroupStyles}>
        <span style={labelStyles}>Stroke</span>
        <Select
          size="sm"
          variant="filled"
          value={strokeWidth}
          onChange={(e) => setStrokeWidth(Number(e.target.value))}
          options={strokeWidthOptions}
          style={{ width: '60px' }}
        />
      </div>

      {showTextControls && (
        <div style={controlGroupStyles}>
          <span style={labelStyles}>Text</span>
          <Select
            size="sm"
            variant="filled"
            value={textSize}
            onChange={(e) => setTextSize(Number(e.target.value))}
            options={textSizeOptions}
            style={{ width: '60px' }}
          />
        </div>
      )}

      {showTextSelectLevel && (
        <div style={controlGroupStyles}>
          <span style={labelStyles}>Level</span>
          <Select
            size="sm"
            variant="filled"
            value={textSelectLevel}
            onChange={(e) =>
              setTextSelectLevel(
                e.target.value as 'word' | 'line' | 'paragraph',
              )
            }
            options={textLevelOptions}
            style={{ width: '100px' }}
          />
        </div>
      )}
    </div>
  );
});

export default BottomToolbar;

import React, { memo } from 'react';
import {
  ALargeSmall,
  ArrowUpRight,
  Ellipse,
  Highlighter,
  MousePointer2,
  Pen,
  Pipette,
  Square,
  SquareDashedText,
  StrokeWidth,
  Type,
} from 'lucide-react';
import type { ToolType } from '../../hooks/use-editor-state';
import {
  ColorDot,
  Island,
  IslandSeparator,
  Select,
  ToolButton,
} from '../../design-system';
import styles from './BottomToolbar.module.css';

type TextSelectLevel = 'word' | 'line' | 'paragraph';

interface BottomToolbarProps {
  /** Lets the editor measure the dock. */
  toolbarRef?: React.Ref<HTMLDivElement>;
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
  textSelectLevel: TextSelectLevel;
  setTextSelectLevel: (lvl: TextSelectLevel) => void;
}

const MODE_TOOLS: ReadonlyArray<{
  tool: ToolType;
  label: string;
  icon: React.ReactNode;
}> = [
  { tool: 'text-select', label: 'Text Highlight', icon: <SquareDashedText /> },
  { tool: 'highlighter', label: 'Highlight', icon: <Highlighter /> },
  { tool: 'rect', label: 'Rect', icon: <Square /> },
  { tool: 'ellipse', label: 'Ellipse', icon: <Ellipse /> },
  { tool: 'arrow', label: 'Arrow', icon: <ArrowUpRight /> },
  { tool: 'text', label: 'Text', icon: <Type /> },
];

const STROKE_COLORS = [
  '#ef4444',
  '#f59e0b',
  '#22c55e',
  '#3b82f6',
  '#ffffff',
  '#000000',
];

const STROKE_WIDTH_OPTIONS = [1, 2, 3, 4, 6, 8, 12].map((value) => ({
  value,
  label: String(value),
}));

const TEXT_SIZE_OPTIONS = [14, 16, 18, 20, 24, 28].map((value) => ({
  value,
  label: String(value),
}));

const TEXT_LEVEL_OPTIONS = [
  { value: 'word', label: 'Word' },
  { value: 'line', label: 'Line' },
  { value: 'paragraph', label: 'Paragraph' },
];

type EyeDropperWindow = Window & {
  EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
};

/** The tool dock: tools, stroke colours, then the active tool's options. */
const BottomToolbar = memo(function BottomToolbar({
  toolbarRef,
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
  const pickColor = async () => {
    try {
      const EyeDropperCtor = (window as EyeDropperWindow).EyeDropper;
      if (EyeDropperCtor) {
        const res = await new EyeDropperCtor().open();
        setStrokeColor(res?.sRGBHex || '#ffffff');
      }
    } catch {
      // noop
    }
  };

  const modeButton = (tool: ToolType, label: string, icon: React.ReactNode) => (
    <ToolButton
      key={tool}
      label={label}
      icon={icon}
      active={activeTool === tool}
      pressed={activeTool === tool}
      onClick={() => setActiveTool(tool)}
    />
  );

  return (
    <Island
      islandRef={toolbarRef}
      role="toolbar"
      aria-label="Editor tools"
      layout="dock"
      className={styles.dock}
    >
      {modeButton('select', 'Select', <MousePointer2 />)}
      {modeButton('pen', 'Pen', <Pen />)}
      <ToolButton label="Eyedropper" icon={<Pipette />} onClick={pickColor} />
      {MODE_TOOLS.map(({ tool, label, icon }) => modeButton(tool, label, icon))}

      <IslandSeparator />

      {STROKE_COLORS.map((color) => (
        <ColorDot
          key={color}
          color={color}
          selected={strokeColor === color}
          onClick={() => setStrokeColor(color)}
        />
      ))}

      <IslandSeparator />

      <Select
        size="dock"
        mono
        icon={<StrokeWidth aria-hidden />}
        aria-label="Stroke width"
        tooltip="Stroke width"
        tooltipPlacement="top"
        value={strokeWidth}
        onChange={(e) => setStrokeWidth(Number(e.target.value))}
        options={STROKE_WIDTH_OPTIONS}
      />

      {showTextControls && (
        <Select
          size="dock"
          mono
          icon={<ALargeSmall aria-hidden />}
          aria-label="Text size"
          tooltip="Text size"
          tooltipPlacement="top"
          value={textSize}
          onChange={(e) => setTextSize(Number(e.target.value))}
          options={TEXT_SIZE_OPTIONS}
        />
      )}

      {showTextSelectLevel && (
        <Select
          size="dock"
          aria-label="Level"
          tooltip="Level"
          tooltipPlacement="top"
          value={textSelectLevel}
          onChange={(e) =>
            setTextSelectLevel(e.target.value as TextSelectLevel)
          }
          options={TEXT_LEVEL_OPTIONS}
        />
      )}
    </Island>
  );
});

export default BottomToolbar;

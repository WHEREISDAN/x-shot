import { useCallback, useEffect, useState } from 'react';
import type { AppPreferences } from '../../../shared/ipc-types';
import type { UpdatePreferences } from '../../hooks/use-preferences';
import { ColorDot, Input, Slider } from '../../design-system';
import SettingsCard from './SettingsCard';
import SettingsRow from './SettingsRow';
import controls from './PreferenceControls.module.css';

interface EditorSectionProps {
  preferences: AppPreferences;
  onUpdate: UpdatePreferences;
  /** Saves debounced changes now. */
  onFlush: () => void;
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

const HEX_COLOR = /^#[0-9A-F]{6}$/i;

function normalizeStrokeColor(raw: string): string | null {
  const trimmed = raw.trim();
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : null;
}

function normalizeFillColor(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.toLowerCase() === 'transparent') return 'transparent';
  return HEX_COLOR.test(trimmed) ? trimmed.toLowerCase() : null;
}

export default function EditorSection({
  preferences,
  onUpdate,
  onFlush,
}: EditorSectionProps) {
  const { editor } = preferences;
  const fillTransparent = editor.defaultFillColor === 'transparent';
  const [strokeDraft, setStrokeDraft] = useState(editor.defaultStrokeColor);
  const [fillDraft, setFillDraft] = useState(editor.defaultFillColor);

  useEffect(() => {
    setStrokeDraft(editor.defaultStrokeColor);
  }, [editor.defaultStrokeColor]);

  useEffect(() => {
    setFillDraft(editor.defaultFillColor);
  }, [editor.defaultFillColor]);

  const handleStrokeColorChange = useCallback(
    (defaultStrokeColor: string) =>
      onUpdate({ editor: { defaultStrokeColor } }, { debounce: true }),
    [onUpdate],
  );

  const handleFillColorChange = useCallback(
    (defaultFillColor: string) =>
      onUpdate({ editor: { defaultFillColor } }, { debounce: true }),
    [onUpdate],
  );

  return (
    <>
      <SettingsCard label="Default Colors">
        <SettingsRow
          labelId="stroke-color-label"
          label="Stroke Color"
          description="Drawing tools: pen, arrows, shapes"
        >
          <div
            className={controls.colorDots}
            role="radiogroup"
            aria-labelledby="stroke-color-label"
          >
            {COLOR_PRESETS.map((color) => (
              <ColorDot
                key={color}
                color={color}
                selected={editor.defaultStrokeColor === color}
                onClick={() => {
                  setStrokeDraft(color);
                  handleStrokeColorChange(color);
                }}
              />
            ))}
          </div>
        </SettingsRow>
        <SettingsRow
          labelId="custom-stroke-color-label"
          label="Custom Stroke Color"
        >
          <Input
            id="stroke-color-section"
            type="color"
            aria-label="Stroke color picker"
            value={editor.defaultStrokeColor}
            onChange={(e) => {
              setStrokeDraft(e.target.value);
              handleStrokeColorChange(e.target.value);
            }}
            onBlur={onFlush}
          />
          <Input
            type="text"
            mono
            aria-labelledby="custom-stroke-color-label"
            value={strokeDraft}
            onChange={(e) => {
              const next = e.target.value;
              setStrokeDraft(next);
              const normalized = normalizeStrokeColor(next);
              if (normalized) {
                setStrokeDraft(normalized);
                handleStrokeColorChange(normalized);
              }
            }}
            onBlur={() => {
              const normalized = normalizeStrokeColor(strokeDraft);
              if (normalized) {
                setStrokeDraft(normalized);
                if (normalized !== editor.defaultStrokeColor) {
                  handleStrokeColorChange(normalized);
                }
              } else {
                setStrokeDraft(editor.defaultStrokeColor);
              }
              onFlush();
            }}
            placeholder="#ff0000"
            className={controls.hex}
          />
        </SettingsRow>
        <SettingsRow
          labelId="fill-color-label"
          label="Fill Color"
          description="Shapes: rectangles, ellipses"
        >
          <div
            className={controls.colorDots}
            role="radiogroup"
            aria-labelledby="fill-color-label"
          >
            <ColorDot
              color="transparent"
              selected={fillTransparent}
              onClick={() => {
                setFillDraft('transparent');
                handleFillColorChange('transparent');
              }}
            />
            {COLOR_PRESETS.map((color) => (
              <ColorDot
                key={color}
                color={color}
                selected={editor.defaultFillColor === color}
                onClick={() => {
                  setFillDraft(color);
                  handleFillColorChange(color);
                }}
              />
            ))}
          </div>
        </SettingsRow>
        <SettingsRow
          labelId="custom-fill-color-label"
          label="Custom Fill Color"
        >
          <Input
            type="color"
            aria-label="Fill color picker"
            value={fillTransparent ? '#ffffff' : editor.defaultFillColor}
            onChange={(e) => {
              setFillDraft(e.target.value);
              handleFillColorChange(e.target.value);
            }}
            onBlur={onFlush}
            className={fillTransparent ? controls.transparentChip : undefined}
          />
          <Input
            type="text"
            mono
            aria-labelledby="custom-fill-color-label"
            value={fillDraft}
            onChange={(e) => {
              const next = e.target.value;
              setFillDraft(next);
              const normalized = normalizeFillColor(next);
              if (normalized) {
                setFillDraft(normalized);
                handleFillColorChange(normalized);
              }
            }}
            onBlur={() => {
              const normalized = normalizeFillColor(fillDraft);
              if (normalized) {
                setFillDraft(normalized);
                if (normalized !== editor.defaultFillColor) {
                  handleFillColorChange(normalized);
                }
              } else {
                setFillDraft(editor.defaultFillColor);
              }
              onFlush();
            }}
            placeholder="transparent or #ff0000"
            className={controls.field}
          />
        </SettingsRow>
      </SettingsCard>

      <SettingsCard label="Default Sizes">
        <SettingsRow
          labelId="stroke-width-label"
          label="Stroke Width"
          description="Thickness of drawing tools and shape outlines, 1–20 px"
        >
          <div className={controls.slider}>
            <Slider
              labelledBy="stroke-width-label"
              min={1}
              max={20}
              value={editor.defaultStrokeWidth}
              onChange={(defaultStrokeWidth) =>
                onUpdate({ editor: { defaultStrokeWidth } }, { debounce: true })
              }
              onBlur={onFlush}
            />
          </div>
        </SettingsRow>
        <SettingsRow
          labelId="text-size-label"
          label="Text Size"
          description="Font size of the text tool, 8–72 px"
        >
          <div className={controls.slider}>
            <Slider
              labelledBy="text-size-label"
              min={8}
              max={72}
              value={editor.defaultTextSize}
              onChange={(defaultTextSize) =>
                onUpdate({ editor: { defaultTextSize } }, { debounce: true })
              }
              onBlur={onFlush}
            />
          </div>
        </SettingsRow>
      </SettingsCard>
    </>
  );
}

import React from 'react';
import { PanelRight, Plus } from 'lucide-react';
import type {
  AspectPreset,
  PresentationActions,
  PresentationSettings,
} from '../../hooks/use-presentation-state';
import type { BackgroundImageRef } from '../../../shared/ipc-types';
import PRESENTATION_BOUNDS from '../../../shared/presentation-bounds';
import { presets, toCssGradient } from './gradient-presets';
import { BUILTIN_BACKGROUNDS, builtinBackgroundRef } from './background-images';
import {
  IconButton,
  Input,
  Island,
  SegmentedControl,
  Select,
  Slider,
  Switch,
} from '../../design-system';
import cx from '../../design-system/class-names';
import tooltipStyles from '../../design-system/components/Tooltip.module.css';
import styles from './PresentationPanel.module.css';

const ASPECT_PRESETS = [
  { value: 'auto', label: 'Auto' },
  { value: '1:1', label: '1:1' },
  { value: '4:3', label: '4:3' },
  { value: '3:2', label: '3:2' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: 'custom', label: 'Custom' },
];

const EXPORT_SCALES = [1, 2, 3, 4].map((value) => ({
  value,
  label: `${value}x`,
}));

/** Reads the picked file and stores it in main as a background. */
async function importBackground(file: File): Promise<BackgroundImageRef> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const result = await window.electron.ipcRenderer.invoke(
    'import-background-image',
    { bytes },
  );
  if (!result.ok) throw new Error(result.error);
  return result.image;
}

function UploadBackgroundButton({
  onSelect,
  onError,
}: {
  onSelect: (image: BackgroundImageRef) => void;
  onError: (message: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.hiddenFileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (!file) return;
          importBackground(file)
            .then(onSelect)
            .catch((error: Error) =>
              onError(`Couldn't use that image: ${error.message}`),
            );
        }}
      />
      <button
        type="button"
        aria-label="Upload background image"
        data-tooltip="Upload your image"
        data-tooltip-align="end"
        onClick={() => inputRef.current?.click()}
        className={cx(styles.swatch, styles.upload, tooltipStyles.tip)}
      >
        <Plus aria-hidden />
      </button>
    </>
  );
}

interface PresentationPanelProps {
  settings: PresentationSettings;
  onChange: PresentationActions;
  onHide: () => void;
  className?: string;
}

export default function PresentationPanel({
  settings,
  onChange,
  onHide,
  className,
}: PresentationPanelProps) {
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const image = settings.backgroundImage;
  const currentGradient = image ? null : toCssGradient(settings.gradient);
  const shadowOff = !settings.shadow.enabled;

  return (
    <Island
      role="complementary"
      aria-label="Presentation panel"
      className={cx(styles.panel, className)}
    >
      <header className={styles.header}>
        <h3 className={styles.title}>Presentation</h3>
        <IconButton
          label="Hide Presentation panel"
          icon={<PanelRight />}
          onClick={onHide}
          tooltipAlign="end"
        />
      </header>

      <div className={styles.body}>
        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Background</h4>
          <div className={styles.swatches}>
            {BUILTIN_BACKGROUNDS.map(({ id, src }) => (
              <button
                type="button"
                key={`img-${id}`}
                aria-label={`Background image ${id}`}
                aria-pressed={image?.kind === 'builtin' && image.id === id}
                onClick={() =>
                  onChange.setBackgroundImage(builtinBackgroundRef(id))
                }
                className={cx(
                  styles.swatch,
                  image?.kind === 'builtin' &&
                    image.id === id &&
                    styles.selected,
                )}
                style={{ background: `url(${src}) center/cover no-repeat` }}
              />
            ))}
            {presets.slice(0, 11).map((g, i) => {
              const css = toCssGradient(g);
              return (
                <button
                  type="button"
                  key={`${g.kind}-${g.angleDeg}-${g.stops.map((s) => s.color).join('-')}`}
                  aria-label={`Gradient ${i + 1}`}
                  aria-pressed={css === currentGradient}
                  onClick={() => {
                    onChange.setBackgroundImage(null);
                    onChange.setGradient(g);
                  }}
                  className={cx(
                    styles.swatch,
                    css === currentGradient && styles.selected,
                  )}
                  style={{ background: css }}
                />
              );
            })}
            <UploadBackgroundButton
              onSelect={(picked) => {
                setUploadError(null);
                onChange.setBackgroundImage(picked);
              }}
              onError={setUploadError}
            />
          </div>
          {uploadError && (
            <div role="alert" className={styles.uploadError}>
              {uploadError}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Frame</h4>
          <Slider
            label="Padding"
            min={PRESENTATION_BOUNDS.padding.min}
            max={PRESENTATION_BOUNDS.padding.max}
            value={settings.padding}
            onChange={onChange.setPadding}
            onBlur={onChange.flush}
          />
          <Slider
            label="Inset"
            min={PRESENTATION_BOUNDS.inset.min}
            max={PRESENTATION_BOUNDS.inset.max}
            value={settings.inset}
            onChange={onChange.setInset}
            onBlur={onChange.flush}
          />
          <Slider
            label="Radius"
            min={PRESENTATION_BOUNDS.radius.min}
            max={PRESENTATION_BOUNDS.radius.max}
            value={settings.radius}
            onChange={onChange.setRadius}
            onBlur={onChange.flush}
          />
          <div className={styles.border}>
            <span>Border</span>
            <Input
              type="color"
              aria-label="Border color"
              value={settings.borderColor}
              onChange={(e) => onChange.setBorderColor(e.target.value)}
              onBlur={onChange.flush}
            />
            <Input
              aria-label="Border hex"
              className={styles.hex}
              mono
              fullWidth
              value={settings.borderColor}
              onChange={(e) => onChange.setBorderColor(e.target.value)}
              onBlur={onChange.flush}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>
            <Switch
              className={styles.sectionSwitch}
              checked={settings.shadow.enabled}
              onChange={(enabled) => onChange.setShadow({ enabled })}
            >
              Shadow
            </Switch>
          </h4>
          <Slider
            label="Offset X"
            min={PRESENTATION_BOUNDS.shadowX.min}
            max={PRESENTATION_BOUNDS.shadowX.max}
            value={settings.shadow.x}
            onChange={(x) => onChange.setShadow({ x })}
            onBlur={onChange.flush}
            disabled={shadowOff}
          />
          <Slider
            label="Offset Y"
            min={PRESENTATION_BOUNDS.shadowY.min}
            max={PRESENTATION_BOUNDS.shadowY.max}
            value={settings.shadow.y}
            onChange={(y) => onChange.setShadow({ y })}
            onBlur={onChange.flush}
            disabled={shadowOff}
          />
          <Slider
            label="Blur"
            min={PRESENTATION_BOUNDS.shadowBlur.min}
            max={PRESENTATION_BOUNDS.shadowBlur.max}
            value={settings.shadow.blur}
            onChange={(blur) => onChange.setShadow({ blur })}
            onBlur={onChange.flush}
            disabled={shadowOff}
          />
          <Slider
            label="Spread"
            min={PRESENTATION_BOUNDS.shadowSpread.min}
            max={PRESENTATION_BOUNDS.shadowSpread.max}
            value={settings.shadow.spread}
            onChange={(spread) => onChange.setShadow({ spread })}
            onBlur={onChange.flush}
            disabled={shadowOff}
          />
        </section>

        <section className={styles.section}>
          <h4 className={styles.sectionTitle}>Size</h4>
          <div className={styles.sizeRow}>
            <Select
              aria-label="Aspect ratio"
              fullWidth
              value={settings.aspect.preset}
              onChange={(e) =>
                onChange.setAspectPreset(e.target.value as AspectPreset)
              }
              options={ASPECT_PRESETS}
            />
            <SegmentedControl
              label="Export scale"
              options={EXPORT_SCALES}
              value={settings.exportScale}
              onChange={onChange.setExportScale}
            />
          </div>
          {settings.aspect.preset === 'custom' && (
            <div className={styles.sizeRow}>
              <Input
                type="number"
                aria-label="Custom width"
                min={PRESENTATION_BOUNDS.customAspect.min}
                max={PRESENTATION_BOUNDS.customAspect.max}
                mono
                fullWidth
                value={settings.aspect.custom?.w ?? ''}
                onChange={(e) =>
                  onChange.setCustomAspect(
                    Number(e.target.value || 1),
                    settings.aspect.custom?.h ?? 1,
                  )
                }
                placeholder="W"
              />
              <Input
                type="number"
                aria-label="Custom height"
                min={PRESENTATION_BOUNDS.customAspect.min}
                max={PRESENTATION_BOUNDS.customAspect.max}
                mono
                fullWidth
                value={settings.aspect.custom?.h ?? ''}
                onChange={(e) =>
                  onChange.setCustomAspect(
                    settings.aspect.custom?.w ?? 1,
                    Number(e.target.value || 1),
                  )
                }
                placeholder="H"
              />
            </div>
          )}
        </section>
      </div>
    </Island>
  );
}

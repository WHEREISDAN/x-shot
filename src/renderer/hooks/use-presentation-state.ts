import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  BackgroundImageRef,
  PreferencesUpdate,
  PresentationPreferences,
} from '../../shared/ipc-types';
import { deepMerge } from '../../shared/deep-merge';
import { createRendererLogger } from '../utils/logger';
import usePreferencesWriter from './use-preferences-writer';

const logger = createRendererLogger('use-presentation-state');

export type AspectPreset = PresentationPreferences['aspect']['preset'];
export type GradientSettings = PresentationPreferences['gradient'];
export type GradientStop = GradientSettings['stops'][number];
export type ShadowSettings = PresentationPreferences['shadow'];

/**
 * The saved presentation plus this capture's export scale, which starts at
 * the export.defaultScale preference and is never saved back.
 */
export interface PresentationSettings extends PresentationPreferences {
  exportScale: number;
}

const defaultSettings: PresentationSettings = {
  gradient: {
    kind: 'linear',
    angleDeg: 45,
    stops: [
      { offset: 0, color: '#7c3aed' },
      { offset: 1, color: '#22d3ee' },
    ],
  },
  backgroundImage: null,
  padding: 48,
  inset: 16,
  radius: 24,
  shadow: {
    enabled: true,
    x: 0,
    y: 18,
    blur: 48,
    spread: 4,
    color: 'rgba(0,0,0,0.35)',
  },
  aspect: { preset: 'auto' },
  exportScale: 1,
  borderColor: '#0b0b0c',
};

export const clampExportScale = (scale: number) =>
  Math.max(1, Math.min(4, Math.round(scale)));

export interface PresentationActions {
  setGradient: (g: Partial<GradientSettings>) => void;
  setGradientStops: (stops: GradientStop[]) => void;
  setBackgroundImage: (image: BackgroundImageRef | null) => void;
  setPadding: (px: number) => void;
  setInset: (px: number) => void;
  setRadius: (px: number) => void;
  setShadow: (s: Partial<ShadowSettings>) => void;
  setAspectPreset: (a: AspectPreset) => void;
  setCustomAspect: (w: number, h: number) => void;
  setExportScale: (scale: number) => void;
  setBorderColor: (color: string) => void;
  /** Saves slider and color changes still waiting for a pause. */
  flush: () => void;
}

export function usePresentationState(): [
  PresentationSettings,
  PresentationActions,
] {
  const [settings, setSettings] =
    useState<PresentationSettings>(defaultSettings);
  const writer = usePreferencesWriter((result) => {
    if (!result.ok) {
      logger.warn('Failed to save presentation preferences', {
        error: result.error,
      });
    }
  });

  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return;
    const load = async () => {
      const preferences = await api.invoke('get-preferences', {});
      if (!preferences?.presentation) return;
      setSettings({
        ...preferences.presentation,
        exportScale: clampExportScale(preferences.export.defaultScale),
      });
    };
    load().catch((error) =>
      logger.warn('Failed to load presentation preferences', error),
    );
  }, []);

  /** Applies a change now; saves it at once or after a pause. */
  const change = useCallback(
    (
      presentation: Partial<PresentationPreferences>,
      timing: 'now' | 'debounced',
    ) => {
      setSettings((current) => deepMerge(current, presentation));
      const updates: PreferencesUpdate = { presentation };
      if (timing === 'debounced') {
        writer.schedule(updates);
      } else {
        writer.flush(updates).catch(() => {});
      }
    },
    [writer],
  );

  const actions = useMemo<PresentationActions>(
    () => ({
      setGradient: (g) =>
        // Picking a gradient replaces any background image.
        change(
          { backgroundImage: null, gradient: { ...settings.gradient, ...g } },
          'now',
        ),
      setGradientStops: (stops) =>
        change({ gradient: { ...settings.gradient, stops } }, 'debounced'),
      setBackgroundImage: (image) => change({ backgroundImage: image }, 'now'),
      setPadding: (px) =>
        change({ padding: Math.max(0, Math.round(px)) }, 'debounced'),
      setInset: (px) =>
        change({ inset: Math.max(0, Math.round(px)) }, 'debounced'),
      setRadius: (px) =>
        change({ radius: Math.max(0, Math.round(px)) }, 'debounced'),
      setShadow: (s) =>
        change(
          { shadow: { ...settings.shadow, ...s } },
          s.enabled === undefined ? 'debounced' : 'now',
        ),
      setAspectPreset: (preset) =>
        change(
          { aspect: { ...settings.aspect, preset } },
          preset === 'custom' ? 'debounced' : 'now',
        ),
      setCustomAspect: (w, h) =>
        change(
          {
            aspect: {
              preset: 'custom',
              custom: {
                w: Math.max(1, Math.round(w)),
                h: Math.max(1, Math.round(h)),
              },
            },
          },
          'debounced',
        ),
      setExportScale: (scale) =>
        setSettings((current) => ({
          ...current,
          exportScale: clampExportScale(scale),
        })),
      setBorderColor: (color) =>
        change({ borderColor: color || '#000000' }, 'debounced'),
      flush: () => {
        writer.flush().catch(() => {});
      },
    }),
    [change, settings.gradient, settings.shadow, settings.aspect, writer],
  );

  return [settings, actions];
}

export function clampRadius(
  radius: number,
  width: number,
  height: number,
): number {
  return Math.min(radius, Math.floor(Math.min(width, height) / 2));
}

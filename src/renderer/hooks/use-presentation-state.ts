import { useCallback, useMemo, useState, useEffect } from 'react';
import safeLocalStorage from '../utils/storage';
import { createRendererLogger } from '../utils/logger';

const logger = createRendererLogger('use-presentation-state');

export type AspectPreset =
  | 'auto'
  | '1:1'
  | '4:3'
  | '3:2'
  | '16:9'
  | '9:16'
  | 'custom';

export interface GradientStop {
  offset: number;
  color: string;
}

export interface GradientSettings {
  kind: 'linear' | 'radial';
  angleDeg: number;
  stops: GradientStop[];
}

export interface ShadowSettings {
  enabled: boolean;
  x: number;
  y: number;
  blur: number;
  spread: number;
  color: string;
}

export interface PresentationSettings {
  gradient: GradientSettings;
  backgroundImageUrl?: string | null;
  padding: number;
  inset: number;
  radius: number;
  shadow: ShadowSettings;
  aspect: { preset: AspectPreset; custom?: { w: number; h: number } };
  exportScale: number;
  borderColor: string;
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
  backgroundImageUrl: null,
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

export function usePresentationState(): [
  PresentationSettings,
  {
    setGradient: (g: Partial<GradientSettings>) => void;
    setGradientStops: (stops: GradientStop[]) => void;
    setBackgroundImage: (url: string | null) => void;
    setPadding: (px: number) => void;
    setInset: (px: number) => void;
    setRadius: (px: number) => void;
    setShadow: (s: Partial<ShadowSettings>) => void;
    setAspectPreset: (a: AspectPreset) => void;
    setCustomAspect: (w: number, h: number) => void;
    setExportScale: (scale: number) => void;
    setBorderColor: (color: string) => void;
  },
] {
  const [settings, setSettings] =
    useState<PresentationSettings>(defaultSettings);

  // Load presentation settings from preferences
  useEffect(() => {
    const loadPresentationPreferences = async () => {
      try {
        const api = window?.electron?.ipcRenderer;
        if (!api) {
          // Fall back to localStorage for testing or if IPC not available
          const raw = safeLocalStorage.getItem('xshot:presentation');
          if (raw) {
            const parsed = JSON.parse(raw) as PresentationSettings;
            setSettings(parsed);
          }
          return;
        }

        const preferences = await api.invoke('get-preferences', {});
        if (preferences?.presentation) {
          setSettings(preferences.presentation);
        }
      } catch (error) {
        logger.warn('Failed to load presentation preferences', error);
      }
    };

    loadPresentationPreferences();
  }, []);

  const save = useCallback(async (next: PresentationSettings) => {
    setSettings(next);

    try {
      const api = window?.electron?.ipcRenderer;
      if (!api) {
        // Fall back to localStorage for testing
        safeLocalStorage.setItem('xshot:presentation', JSON.stringify(next));
        return;
      }

      await api.invoke('set-preferences', {
        preferences: {
          presentation: next,
        },
      });
    } catch (error) {
      logger.warn('Failed to save presentation preferences', error);
      // Fall back to localStorage
      safeLocalStorage.setItem('xshot:presentation', JSON.stringify(next));
    }
  }, []);

  const actions = useMemo(
    () => ({
      setGradient: (g: Partial<GradientSettings>) =>
        // Selecting a gradient should clear any background image
        save({
          ...settings,
          backgroundImageUrl: null,
          gradient: { ...settings.gradient, ...g },
        }),
      setGradientStops: (stops: GradientStop[]) =>
        save({ ...settings, gradient: { ...settings.gradient, stops } }),
      setBackgroundImage: (url: string | null) =>
        save({ ...settings, backgroundImageUrl: url }),
      setPadding: (px: number) =>
        save({ ...settings, padding: Math.max(0, Math.round(px)) }),
      setInset: (px: number) =>
        save({ ...settings, inset: Math.max(0, Math.round(px)) }),
      setRadius: (px: number) =>
        save({ ...settings, radius: Math.max(0, Math.round(px)) }),
      setShadow: (s: Partial<ShadowSettings>) =>
        save({ ...settings, shadow: { ...settings.shadow, ...s } }),
      setAspectPreset: (a: AspectPreset) =>
        save({ ...settings, aspect: { ...settings.aspect, preset: a } }),
      setCustomAspect: (w: number, h: number) =>
        save({
          ...settings,
          aspect: {
            preset: 'custom',
            custom: {
              w: Math.max(1, Math.round(w)),
              h: Math.max(1, Math.round(h)),
            },
          },
        }),
      setExportScale: (scale: number) =>
        save({
          ...settings,
          exportScale: Math.max(1, Math.min(4, Math.round(scale))),
        }),
      setBorderColor: (color: string) =>
        save({ ...settings, borderColor: color || '#000000' }),
    }),
    [save, settings],
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

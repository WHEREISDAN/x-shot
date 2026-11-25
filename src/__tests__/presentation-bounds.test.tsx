import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import PresentationPanel from '../renderer/components/editor/PresentationPanel';
import {
  createDefaultPreferences,
  sanitizePreferences,
} from '../main/preferences-schema';
import type {
  PresentationActions,
  PresentationSettings,
} from '../renderer/hooks/use-presentation-state';

const DEFAULTS = createDefaultPreferences('/tmp');

const mockActions: PresentationActions = {
  setGradient: jest.fn(),
  setGradientStops: jest.fn(),
  setBackgroundImage: jest.fn(),
  setPadding: jest.fn(),
  setInset: jest.fn(),
  setRadius: jest.fn(),
  setShadow: jest.fn(),
  setAspectPreset: jest.fn(),
  setCustomAspect: jest.fn(),
  setExportScale: jest.fn(),
  setBorderColor: jest.fn(),
  flush: jest.fn(),
};

describe('PresentationPanel and preferences-schema bounds alignment', () => {
  it('round-trips 1920x1080 custom aspect and max shadow spread without truncation', () => {
    const input = {
      ...DEFAULTS,
      presentation: {
        ...DEFAULTS.presentation,
        shadow: { ...DEFAULTS.presentation.shadow, spread: 264 },
        aspect: { preset: 'custom' as const, custom: { w: 1920, h: 1080 } },
      },
    };
    const sanitized = sanitizePreferences(input, DEFAULTS);
    expect(sanitized.presentation.aspect).toEqual({
      preset: 'custom',
      custom: { w: 1920, h: 1080 },
    });
    expect(sanitized.presentation.shadow.spread).toBe(264);
  });

  it('keeps every PresentationPanel slider and custom aspect input within schema clamps', () => {
    const settings: PresentationSettings = {
      ...DEFAULTS.presentation,
      aspect: { preset: 'custom', custom: { w: 1920, h: 1080 } },
      exportScale: 1,
    };
    render(
      <PresentationPanel
        settings={settings}
        onChange={mockActions}
        onHide={jest.fn()}
      />,
    );

    const sliderCases: Array<{
      label: string;
      read: (p: typeof DEFAULTS.presentation) => number;
      build: (v: number) => typeof DEFAULTS.presentation;
    }> = [
      {
        label: 'Padding',
        read: (p) => p.padding,
        build: (padding) => ({ ...DEFAULTS.presentation, padding }),
      },
      {
        label: 'Inset',
        read: (p) => p.inset,
        build: (inset) => ({ ...DEFAULTS.presentation, inset }),
      },
      {
        label: 'Radius',
        read: (p) => p.radius,
        build: (radius) => ({ ...DEFAULTS.presentation, radius }),
      },
      {
        label: 'Offset X',
        read: (p) => p.shadow.x,
        build: (x) => ({
          ...DEFAULTS.presentation,
          shadow: { ...DEFAULTS.presentation.shadow, x },
        }),
      },
      {
        label: 'Offset Y',
        read: (p) => p.shadow.y,
        build: (y) => ({
          ...DEFAULTS.presentation,
          shadow: { ...DEFAULTS.presentation.shadow, y },
        }),
      },
      {
        label: 'Blur',
        read: (p) => p.shadow.blur,
        build: (blur) => ({
          ...DEFAULTS.presentation,
          shadow: { ...DEFAULTS.presentation.shadow, blur },
        }),
      },
      {
        label: 'Spread',
        read: (p) => p.shadow.spread,
        build: (spread) => ({
          ...DEFAULTS.presentation,
          shadow: { ...DEFAULTS.presentation.shadow, spread },
        }),
      },
    ];

    sliderCases.forEach(({ label, read, build }) => {
      const slider = screen.getByLabelText(label);
      const min = Number(slider.getAttribute('min'));
      const max = Number(slider.getAttribute('max'));
      expect(
        read(
          sanitizePreferences(
            { ...DEFAULTS, presentation: build(min) },
            DEFAULTS,
          ).presentation,
        ),
      ).toBe(min);
      expect(
        read(
          sanitizePreferences(
            { ...DEFAULTS, presentation: build(max) },
            DEFAULTS,
          ).presentation,
        ),
      ).toBe(max);
    });

    const widthInput = screen.getByLabelText('Custom width');
    const heightInput = screen.getByLabelText('Custom height');
    expect(widthInput).toHaveAttribute('min', '1');
    expect(widthInput).toHaveAttribute('max', '10000');
    expect(heightInput).toHaveAttribute('min', '1');
    expect(heightInput).toHaveAttribute('max', '10000');

    const maxCustom = sanitizePreferences(
      {
        ...DEFAULTS,
        presentation: {
          ...DEFAULTS.presentation,
          aspect: { preset: 'custom', custom: { w: 10000, h: 10000 } },
        },
      },
      DEFAULTS,
    );
    expect(maxCustom.presentation.aspect.custom).toEqual({
      w: 10000,
      h: 10000,
    });
  });
});

import React from 'react';
import PresentationPanel from './PresentationPanel';
import type {
  PresentationSettings,
  AspectPreset,
} from '../../hooks/use-presentation-state';

interface SidePanelProps {
  settings: PresentationSettings;
  onChange: {
    setPadding: (n: number) => void;
    setInset: (n: number) => void;
    setRadius: (n: number) => void;
    setAspectPreset: (a: AspectPreset) => void;
    setCustomAspect: (w: number, h: number) => void;
    setExportScale: (n: number) => void;
    setShadow: (s: Partial<PresentationSettings['shadow']>) => void;
    setGradient: (g: Partial<PresentationSettings['gradient']>) => void;
    setBackgroundImage: (url: string | null) => void;
    setBorderColor: (c: string) => void;
  };
}

export default function SidePanel({ settings, onChange }: SidePanelProps) {
  return <PresentationPanel settings={settings} onChange={onChange} />;
}

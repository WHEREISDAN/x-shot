import React from 'react';
import PresentationPanel from './PresentationPanel';
import type {
  PresentationActions,
  PresentationSettings,
} from '../../hooks/use-presentation-state';

interface SidePanelProps {
  settings: PresentationSettings;
  onChange: PresentationActions;
}

export default function SidePanel({ settings, onChange }: SidePanelProps) {
  return <PresentationPanel settings={settings} onChange={onChange} />;
}

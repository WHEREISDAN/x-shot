import type { GradientSettings } from '../../hooks/use-presentation-state';

export const presets: GradientSettings[] = [
  {
    kind: 'linear',
    angleDeg: 45,
    stops: [
      { offset: 0, color: '#0f0c29' },
      { offset: 0.5, color: '#302b63' },
      { offset: 1, color: '#24243e' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 35,
    stops: [
      { offset: 0, color: '#22d3ee' },
      { offset: 1, color: '#7c3aed' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 90,
    stops: [
      { offset: 0, color: '#14b8a6' },
      { offset: 1, color: '#3b82f6' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 30,
    stops: [
      { offset: 0, color: '#f472b6' },
      { offset: 1, color: '#60a5fa' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 120,
    stops: [
      { offset: 0, color: '#0f2027' },
      { offset: 0.5, color: '#203a43' },
      { offset: 1, color: '#2c5364' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 0,
    stops: [
      { offset: 0, color: '#0ea5e9' },
      { offset: 1, color: '#22c55e' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 145,
    stops: [
      { offset: 0, color: '#f97316' },
      { offset: 1, color: '#f43f5e' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 200,
    stops: [
      { offset: 0, color: '#fb923c' },
      { offset: 1, color: '#22d3ee' },
    ],
  },
  // New linear presets
  {
    kind: 'linear',
    angleDeg: 135,
    stops: [
      { offset: 0, color: '#ff7e5f' },
      { offset: 1, color: '#feb47b' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 45,
    stops: [
      { offset: 0, color: '#00c6ff' },
      { offset: 1, color: '#0072ff' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 60,
    stops: [
      { offset: 0, color: '#f857a6' },
      { offset: 1, color: '#ff5858' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 110,
    stops: [
      { offset: 0, color: '#43e97b' },
      { offset: 1, color: '#38f9d7' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 90,
    stops: [
      { offset: 0, color: '#0b132b' },
      { offset: 0.5, color: '#1c2541' },
      { offset: 1, color: '#3a506b' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 315,
    stops: [
      { offset: 0, color: '#fbd786' },
      { offset: 1, color: '#f7797d' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 160,
    stops: [
      { offset: 0, color: '#fee140' },
      { offset: 1, color: '#fa709a' },
    ],
  },
  {
    kind: 'linear',
    angleDeg: 180,
    stops: [
      { offset: 0, color: '#a18cd1' },
      { offset: 0.5, color: '#fbc2eb' },
      { offset: 1, color: '#a18cd1' },
    ],
  },
  // New radial presets (angleDeg is unused for radial)
  {
    kind: 'radial',
    angleDeg: 0,
    stops: [
      { offset: 0, color: '#84fab0' },
      { offset: 1, color: '#8fd3f4' },
    ],
  },
  {
    kind: 'radial',
    angleDeg: 0,
    stops: [
      { offset: 0, color: '#1e1b4b' },
      { offset: 0.7, color: '#0f172a' },
      { offset: 1, color: '#020617' },
    ],
  },
  {
    kind: 'radial',
    angleDeg: 0,
    stops: [
      { offset: 0, color: '#48c6ef' },
      { offset: 1, color: '#6f86d6' },
    ],
  },
  {
    kind: 'radial',
    angleDeg: 0,
    stops: [
      { offset: 0, color: '#ffecd2' },
      { offset: 1, color: '#fcb69f' },
    ],
  },
];

export function toCssGradient(g: GradientSettings): string {
  if (g.kind === 'linear') {
    const angle = `${g.angleDeg}deg`;
    const stops = g.stops
      .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
      .join(', ');
    return `linear-gradient(${angle}, ${stops})`;
  }
  // Use percentage-based positioning for better scaling with large canvases
  const stops = g.stops
    .map((s) => `${s.color} ${Math.round(s.offset * 100)}%`)
    .join(', ');
  return `radial-gradient(circle farthest-corner at 50% 50%, ${stops})`;
}

import React from 'react';
import type { SelectionArea } from '../hooks/use-selection';

interface SelectionOverlayProps {
  selection: SelectionArea | null;
}

const handleStyle: React.CSSProperties = {
  position: 'absolute',
  width: 14,
  height: 14,
  marginLeft: -7,
  marginTop: -7,
  background: 'rgba(255,255,255,0.95)',
  borderRadius: 7,
  boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
};

export default function SelectionOverlay({ selection }: SelectionOverlayProps) {
  if (!selection) return null;
  const { x, y, width, height } = selection;

  return (
    <>
      <div
        style={{
          position: 'absolute',
          border: '2px solid rgba(255,255,255,0.9)',
          background: 'transparent',
          left: x,
          top: y,
          width,
          height,
          zIndex: 1001,
          pointerEvents: 'none',
          willChange: 'left, top, width, height',
          transform: 'translateZ(0)',
          boxShadow: '0 6px 20px rgba(0,0,0,0.35)',
        }}
        data-selection-root="1"
      />
      {/* Handles */}
      <div style={{ ...handleStyle, left: x, top: y, pointerEvents: 'none' }} />
      <div
        style={{
          ...handleStyle,
          left: x + width,
          top: y,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          ...handleStyle,
          left: x,
          top: y + height,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          ...handleStyle,
          left: x + width,
          top: y + height,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          ...handleStyle,
          left: x + width / 2,
          top: y,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          ...handleStyle,
          left: x + width / 2,
          top: y + height,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          ...handleStyle,
          left: x,
          top: y + height / 2,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          ...handleStyle,
          left: x + width,
          top: y + height / 2,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}

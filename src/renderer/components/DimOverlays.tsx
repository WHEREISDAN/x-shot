import React from 'react';

interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface DimOverlaysProps {
  top: Rect;
  left: Rect;
  right: Rect;
  bottom: Rect;
}

const baseStyle: React.CSSProperties = {
  position: 'fixed',
  background: 'rgba(0, 0, 0, 0.3)',
  zIndex: 999,
  pointerEvents: 'none',
  willChange: 'left, top, width, height',
  transform: 'translateZ(0)',
};

export default function DimOverlays({
  top,
  left,
  right,
  bottom,
}: DimOverlaysProps) {
  return (
    <>
      <div style={{ ...baseStyle, ...top }} />
      <div style={{ ...baseStyle, ...left }} />
      <div style={{ ...baseStyle, ...right }} />
      <div style={{ ...baseStyle, ...bottom }} />
    </>
  );
}

import React from 'react';

interface QuickDockProps {
  onToggleWindows: () => void;
  onToggleDisplays: () => void;
  onCancel: () => void;
}

export default function QuickDock({
  onToggleWindows,
  onToggleDisplays,
  onCancel,
}: QuickDockProps) {
  return (
    <div
      role="toolbar"
      aria-label="Screenshot quick actions"
      tabIndex={-1}
      onMouseDown={(e) => e.stopPropagation()}
      onMouseUp={(e) => e.stopPropagation()}
      onMouseMove={(e) => e.stopPropagation()}
      data-quick-dock="1"
      style={{
        position: 'fixed',
        left: '50%',
        bottom: 24,
        transform: 'translateX(-50%)',
        zIndex: 1005,
        background: 'rgba(17, 17, 17, 0.85)',
        borderRadius: 16,
        padding: '10px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 10px 30px rgba(0,0,0,0.35)',
        color: 'white',
        pointerEvents: 'auto',
      }}
    >
      <button
        type="button"
        onClick={onToggleWindows}
        style={{
          appearance: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '10px 14px',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.2,
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Windows
      </button>

      <button
        type="button"
        onClick={onToggleDisplays}
        style={{
          appearance: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '10px 14px',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.2,
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        Displays
      </button>

      <button
        type="button"
        onClick={onCancel}
        style={{
          appearance: 'none',
          background: 'transparent',
          color: 'rgba(255,255,255,0.9)',
          border: '1px solid rgba(255,255,255,0.15)',
          padding: '10px 12px',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
        aria-label="Cancel"
        title="Cancel (Esc)"
      >
        Cancel
      </button>
    </div>
  );
}

import React from 'react';
import type {
  ScreenSourceItem,
  WindowSourceItem,
} from '../../shared/ipc-types';

interface SourcesPanelProps<T extends WindowSourceItem | ScreenSourceItem> {
  title: string;
  sources: T[];
  onSelect: (id: string) => void;
}

export default function SourcesPanel<
  T extends WindowSourceItem | ScreenSourceItem,
>({ title, sources, onSelect }: SourcesPanelProps<T>) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
      data-sources-panel="1"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        left: '50%',
        bottom: 76,
        transform: 'translateX(-50%)',
        width: 560,
        maxWidth: '90vw',
        maxHeight: 360,
        overflow: 'auto',
        background: 'rgba(17,17,17,0.9)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 16,
        padding: 12,
        boxShadow: '0 20px 60px rgba(0,0,0,0.45)',
        color: 'white',
      }}
    >
      <div style={{ fontWeight: 700, padding: '6px 8px 12px 8px' }}>
        {title}
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 10,
        }}
      >
        {sources.length === 0 && (
          <div style={{ color: 'rgba(255,255,255,0.7)', padding: 8 }}>
            No items detected
          </div>
        )}
        {sources.map((src) => (
          <button
            key={src.id}
            type="button"
            onClick={() => onSelect(src.id)}
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
            }}
            style={{
              textAlign: 'left',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 12,
              padding: 8,
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              color: 'white',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '16 / 10',
                borderRadius: 8,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              {src.thumbnail ? (
                <img
                  src={src.thumbnail}
                  alt={src.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%' }} />
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {'appIcon' in src && src.appIcon && (
                <img
                  src={src.appIcon}
                  alt="app"
                  style={{ width: 16, height: 16, borderRadius: 4 }}
                />
              )}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={src.name}
              >
                {src.name}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

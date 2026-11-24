import { useId } from 'react';
import type {
  ScreenSourceItem,
  WindowSourceItem,
} from '../../shared/ipc-types';
import { captureAssetUrl } from '../../shared/capture-asset';
import { Island } from '../design-system';
import styles from './SourcesPanel.module.css';

interface SourcesPanelProps<T extends WindowSourceItem | ScreenSourceItem> {
  title: string;
  /** Faint text beside the title, e.g. `3 open`. */
  count: string;
  sources: T[];
  onSelect: (id: string) => void;
}

export default function SourcesPanel<
  T extends WindowSourceItem | ScreenSourceItem,
>({ title, count, sources, onSelect }: SourcesPanelProps<T>) {
  const titleId = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      data-sources-panel="1"
      onPointerDown={(e) => e.stopPropagation()}
      onPointerUp={(e) => e.stopPropagation()}
      onPointerMove={(e) => e.stopPropagation()}
      className={styles.sourcesPanel}
    >
      <Island className={styles.island}>
        <header className={styles.header}>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
          <span className={styles.count}>{count}</span>
        </header>
        <div className={styles.grid}>
          {sources.length === 0 && (
            <div className={styles.empty}>No items detected</div>
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
              className={styles.source}
            >
              <span className={styles.thumbnail}>
                {src.thumbnailAssetId && (
                  <img
                    src={captureAssetUrl(src.thumbnailAssetId)}
                    alt={src.name}
                  />
                )}
              </span>
              <span className={styles.name}>
                {src.appIconAssetId && (
                  <img
                    src={captureAssetUrl(src.appIconAssetId)}
                    alt="app"
                    className={styles.appIcon}
                  />
                )}
                <span className={styles.nameText} title={src.name}>
                  {src.name}
                </span>
              </span>
            </button>
          ))}
        </div>
      </Island>
    </div>
  );
}

import type { AriaRole, ReactNode, Ref } from 'react';
import cx from '../class-names';
import styles from './Island.module.css';

export type IslandLayout = 'plain' | 'bar' | 'dock';

export interface IslandProps {
  children: ReactNode;
  layout?: IslandLayout;
  className?: string;
  role?: AriaRole;
  'aria-label'?: string;
  islandRef?: Ref<HTMLDivElement>;
}

/** The floating surface every panel, bar and toast sits on. */
export function Island({
  children,
  layout = 'plain',
  className,
  role,
  'aria-label': ariaLabel,
  islandRef,
}: IslandProps) {
  return (
    <div
      ref={islandRef}
      role={role}
      aria-label={ariaLabel}
      className={cx(
        styles.island,
        layout === 'bar' && styles.bar,
        layout === 'dock' && styles.dock,
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A thin vertical rule between groups of controls in an island. */
export function IslandSeparator() {
  return <span className={styles.separator} aria-hidden />;
}

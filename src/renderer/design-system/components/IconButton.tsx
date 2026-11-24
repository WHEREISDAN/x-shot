import type { ReactNode } from 'react';
import cx from '../class-names';
import styles from './IconButton.module.css';
import tooltipStyles from './Tooltip.module.css';
import type { TooltipProps } from './tooltip-types';

export interface IconButtonProps extends TooltipProps {
  /** The accessible name, also shown as the tooltip unless one is given. */
  label: string;
  icon: ReactNode;
  onClick: () => void;
  tone?: 'default' | 'danger';
  size?: 'md' | 'sm';
  disabled?: boolean;
  className?: string;
}

/** A 32px icon-only button with a tooltip. */
export function IconButton({
  label,
  icon,
  onClick,
  tone = 'default',
  size = 'md',
  disabled = false,
  className,
  tooltip = label,
  tooltipPlacement = 'bottom',
  tooltipAlign = 'center',
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      data-tooltip={tooltip || undefined}
      data-tooltip-placement={tooltipPlacement}
      data-tooltip-align={tooltipAlign}
      disabled={disabled}
      onClick={onClick}
      className={cx(
        styles.iconButton,
        tone === 'danger' && styles.danger,
        size === 'sm' && styles.small,
        tooltip && tooltipStyles.tip,
        className,
      )}
    >
      {icon}
    </button>
  );
}

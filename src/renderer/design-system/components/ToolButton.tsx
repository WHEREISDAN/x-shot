import type { ReactNode } from 'react';
import cx from '../class-names';
import styles from './ToolButton.module.css';
import tooltipStyles from './Tooltip.module.css';
import type { TooltipAlign, TooltipPlacement } from './tooltip-types';

export interface ToolButtonProps {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  /** Filled while the tool is in use. */
  active?: boolean;
  /** Set for tools that stay on; omit for one-shot actions. */
  pressed?: boolean;
  tooltipPlacement?: TooltipPlacement;
  tooltipAlign?: TooltipAlign;
}

/** A 36px icon button in the tool dock, named and tooltipped by `label`. */
export function ToolButton({
  label,
  icon,
  onClick,
  active = false,
  pressed,
  tooltipPlacement = 'top',
  tooltipAlign = 'center',
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={label}
      data-tooltip-placement={tooltipPlacement}
      data-tooltip-align={tooltipAlign}
      onClick={onClick}
      className={cx(
        styles.toolButton,
        active && styles.active,
        tooltipStyles.tip,
      )}
    >
      {icon}
    </button>
  );
}

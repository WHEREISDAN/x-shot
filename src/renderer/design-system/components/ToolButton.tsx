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
  /** Shows `label` beside the icon instead of only in the tooltip. */
  showLabel?: boolean;
  /** Defaults to `label` for an icon-only button and none for a labelled one. */
  tooltip?: string;
  tooltipPlacement?: TooltipPlacement;
  tooltipAlign?: TooltipAlign;
}

/** A 36px button in a dock, named by `label`. */
export function ToolButton({
  label,
  icon,
  onClick,
  active = false,
  pressed,
  showLabel = false,
  tooltip = showLabel ? undefined : label,
  tooltipPlacement = 'top',
  tooltipAlign = 'center',
}: ToolButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={pressed}
      data-tooltip={tooltip}
      data-tooltip-placement={tooltip && tooltipPlacement}
      data-tooltip-align={tooltip && tooltipAlign}
      onClick={onClick}
      className={cx(
        styles.toolButton,
        showLabel && styles.labelled,
        active && styles.active,
        tooltip && tooltipStyles.tip,
      )}
    >
      {icon}
      {showLabel && label}
    </button>
  );
}

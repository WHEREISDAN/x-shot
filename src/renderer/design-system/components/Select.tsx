import type { ChangeEvent, CSSProperties, FocusEvent, ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import cx from '../class-names';
import styles from './Select.module.css';
import tooltipStyles from './Tooltip.module.css';
import type { TooltipProps } from './tooltip-types';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends TooltipProps {
  value: string | number;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  options: readonly SelectOption[];
  onFocus?: (event: FocusEvent<HTMLSelectElement>) => void;
  onBlur?: (event: FocusEvent<HTMLSelectElement>) => void;
  /** `dock` is the compact 32px option select of the tool dock. */
  size?: 'sm' | 'dock';
  icon?: ReactNode;
  mono?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  id?: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** A native select in a styled box with an optional icon and a chevron. */
export function Select({
  value,
  onChange,
  options,
  onFocus,
  onBlur,
  size = 'sm',
  icon,
  mono = false,
  fullWidth = false,
  disabled = false,
  id,
  name,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  tooltip,
  tooltipPlacement = 'bottom',
  tooltipAlign = 'center',
}: SelectProps) {
  return (
    <span
      data-tooltip={tooltip}
      data-tooltip-placement={tooltipPlacement}
      data-tooltip-align={tooltipAlign}
      className={cx(
        styles.select,
        size === 'dock' && styles.dock,
        icon !== undefined && styles.withIcon,
        mono && styles.mono,
        fullWidth && styles.fullWidth,
        tooltip && tooltipStyles.tip,
        className,
      )}
      style={style}
    >
      {icon !== undefined && <span className={styles.icon}>{icon}</span>}
      <select
        id={id}
        name={name}
        className={styles.native}
        value={value}
        disabled={disabled}
        onChange={onChange}
        onFocus={onFocus}
        onBlur={onBlur}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
      >
        {options.map((option) => (
          <option
            key={option.value}
            value={option.value}
            disabled={option.disabled}
          >
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className={styles.chevron} aria-hidden />
    </span>
  );
}

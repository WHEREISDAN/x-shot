import { useId, type ReactNode } from 'react';
import cx from '../class-names';
import styles from './Switch.module.css';

export interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Visible label, drawn before the track; it names the switch. */
  children?: ReactNode;
  /** Names the switch when it has no visible label. */
  'aria-label'?: string;
  /** Names the switch by another element, such as a settings row label. */
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  disabled?: boolean;
  className?: string;
}

/** An on/off switch over a native checkbox with role="switch". */
export function Switch({
  checked,
  onChange,
  children,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
  'aria-describedby': ariaDescribedBy,
  disabled = false,
  className,
}: SwitchProps) {
  const id = useId();
  return (
    <label htmlFor={id} className={cx(styles.switchLabel, className)}>
      {children}
      <input
        id={id}
        type="checkbox"
        role="switch"
        className={styles.input}
        checked={checked}
        disabled={disabled}
        aria-label={children ? undefined : ariaLabel}
        aria-labelledby={children ? undefined : ariaLabelledBy}
        aria-describedby={ariaDescribedBy}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.track} aria-hidden />
    </label>
  );
}

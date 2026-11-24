import type { ReactNode } from 'react';
import cx from '../class-names';
import styles from './Button.module.css';

export type ButtonVariant = 'secondary' | 'primary';
export type ButtonSize = 'md' | 'sm';

export interface ButtonProps {
  children: ReactNode;
  onClick: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  disabled?: boolean;
  className?: string;
}

/** A text button; `primary` is the one filled button in a window. */
export function Button({
  children,
  onClick,
  variant = 'secondary',
  size = 'md',
  icon,
  disabled = false,
  className,
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cx(
        styles.button,
        variant === 'primary' && styles.primary,
        size === 'sm' && styles.small,
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

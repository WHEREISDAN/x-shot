import type {
  ChangeEvent,
  CSSProperties,
  FocusEvent,
  HTMLInputTypeAttribute,
} from 'react';
import cx from '../class-names';
import styles from './Input.module.css';

export interface InputProps {
  value: string | number;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  type?: HTMLInputTypeAttribute;
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void;
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void;
  placeholder?: string;
  mono?: boolean;
  fullWidth?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  id?: string;
  name?: string;
  className?: string;
  style?: CSSProperties;
  'aria-label'?: string;
  'aria-labelledby'?: string;
}

/** A 28px text field; `type="color"` draws a colour chip. */
export function Input({
  value,
  onChange,
  type = 'text',
  onFocus,
  onBlur,
  placeholder,
  mono = false,
  fullWidth = false,
  readOnly,
  disabled,
  min,
  max,
  step,
  id,
  name,
  className,
  style,
  'aria-label': ariaLabel,
  'aria-labelledby': ariaLabelledBy,
}: InputProps) {
  return (
    <input
      id={id}
      name={name}
      type={type}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      readOnly={readOnly}
      disabled={disabled}
      min={min}
      max={max}
      step={step}
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      className={cx(
        styles.input,
        type === 'color' && styles.color,
        mono && styles.mono,
        fullWidth && styles.fullWidth,
        className,
      )}
      style={style}
    />
  );
}

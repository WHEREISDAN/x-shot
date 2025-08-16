import React from 'react';
import {
  colors,
  spacing,
  borderRadius,
  transitions,
  typography,
} from '../tokens';

export type InputSize = 'sm' | 'md' | 'lg';
export type InputVariant = 'default' | 'filled' | 'minimal';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: InputSize;
  variant?: InputVariant;
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

const sizeStyles: Record<InputSize, React.CSSProperties> = {
  sm: {
    height: '32px',
    padding: '0 12px',
    fontSize: typography.fontSize.sm,
  },
  md: {
    height: '36px',
    padding: '0 16px',
    fontSize: typography.fontSize.base,
  },
  lg: {
    height: '40px',
    padding: '0 20px',
    fontSize: typography.fontSize.md,
  },
};

const variantStyles: Record<InputVariant, React.CSSProperties> = {
  default: {
    background: colors.surface.default,
    border: `1px solid ${colors.border.emphasis}`,
  },
  filled: {
    background: colors.surface.muted,
    border: `1px solid transparent`,
  },
  minimal: {
    background: 'transparent',
    border: 'none',
    borderBottom: `1px solid ${colors.border.default}`,
    borderRadius: '0',
  },
};

export function Input({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  ...props
}: InputProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const generatedId = React.useId();
  const inputId = id || generatedId;

  const baseStyles: React.CSSProperties = {
    fontFamily: typography.fontFamily.system,
    color: colors.text.primary,
    borderRadius: variant === 'minimal' ? '0' : borderRadius.lg,
    transition: transitions.duration.normal,
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'text',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...style,
  };

  const focusStyles: React.CSSProperties = {
    borderColor: error ? colors.error : colors.focus,
    boxShadow: error
      ? `0 0 0 1px ${colors.error}`
      : `0 0 0 1px ${colors.focus}`,
  };

  const errorStyles: React.CSSProperties = {
    borderColor: colors.error,
  };

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[1],
    width: fullWidth ? '100%' : 'auto',
  };

  const inputWrapperStyles: React.CSSProperties = {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    width: '100%',
  };

  const iconStyles: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: colors.text.muted,
    pointerEvents: 'none',
    zIndex: 1,
  };

  const leftIconStyles: React.CSSProperties = {
    ...iconStyles,
    left: spacing[3],
  };

  const rightIconStyles: React.CSSProperties = {
    ...iconStyles,
    right: spacing[3],
  };

  const inputWithIconStyles: React.CSSProperties = {
    ...baseStyles,
    ...(leftIcon
      ? { paddingLeft: `calc(${spacing[3]} + 16px + ${spacing[2]})` }
      : {}),
    ...(rightIcon
      ? { paddingRight: `calc(${spacing[3]} + 16px + ${spacing[2]})` }
      : {}),
    ...(isFocused ? focusStyles : {}),
    ...(error && !isFocused ? errorStyles : {}),
  };

  const labelStyles: React.CSSProperties = {
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing[1],
  };

  const helperTextStyles: React.CSSProperties = {
    fontSize: typography.fontSize.xs,
    color: error ? colors.error : colors.text.muted,
    marginTop: spacing[1],
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label htmlFor={inputId} style={labelStyles}>
          {label}
        </label>
      )}

      <div style={inputWrapperStyles}>
        {leftIcon && <span style={leftIconStyles}>{leftIcon}</span>}

        <input
          id={inputId}
          style={inputWithIconStyles}
          onFocus={(e) => {
            setIsFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setIsFocused(false);
            props.onBlur?.(e);
          }}
          disabled={disabled}
          className={className}
          type={props.type}
          value={props.value}
          onChange={props.onChange}
          placeholder={props.placeholder}
          name={props.name}
          min={props.min}
          max={props.max}
          step={props.step}
        />

        {rightIcon && <span style={rightIconStyles}>{rightIcon}</span>}
      </div>

      {(error || helperText) && (
        <span style={helperTextStyles}>{error || helperText}</span>
      )}
    </div>
  );
}

// Specialized input components
export function NumberInput({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  name,
  min,
  max,
  step,
}: Omit<InputProps, 'type'>) {
  return (
    <Input
      type="number"
      size={size}
      variant={variant}
      label={label}
      error={error}
      helperText={helperText}
      leftIcon={leftIcon}
      rightIcon={rightIcon}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      id={id}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      name={name}
      min={min}
      max={max}
      step={step}
    />
  );
}

export function PasswordInput({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  leftIcon,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder,
  name,
}: Omit<InputProps, 'type' | 'rightIcon'>) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <Input
      type={showPassword ? 'text' : 'password'}
      size={size}
      variant={variant}
      label={label}
      error={error}
      helperText={helperText}
      leftIcon={leftIcon}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      id={id}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      name={name}
      rightIcon={
        <button
          type="button"
          onClick={() => setShowPassword(!showPassword)}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: colors.text.muted,
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {showPassword ? '👁️' : '👁️‍🗨️'}
        </button>
      }
    />
  );
}

export function SearchInput({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  rightIcon,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = 'Search...',
  name,
}: Omit<InputProps, 'type' | 'leftIcon'>) {
  return (
    <Input
      type="search"
      size={size}
      variant={variant}
      label={label}
      error={error}
      helperText={helperText}
      rightIcon={rightIcon}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      id={id}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      name={name}
      leftIcon={
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
      }
    />
  );
}

import React from 'react';
import {
  colors,
  spacing,
  borderRadius,
  transitions,
  typography,
} from '../tokens';

export type SelectSize = 'sm' | 'md' | 'lg';
export type SelectVariant = 'default' | 'filled' | 'minimal';

export interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  size?: SelectSize;
  variant?: SelectVariant;
  label?: string;
  error?: string;
  helperText?: string;
  placeholder?: string;
  options?: SelectOption[];
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const sizeStyles: Record<SelectSize, React.CSSProperties> = {
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

const variantStyles: Record<SelectVariant, React.CSSProperties> = {
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

export function Select({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  placeholder,
  options,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  children,
  ...props
}: SelectProps) {
  const [isFocused, setIsFocused] = React.useState(false);
  const generatedId = React.useId();
  const selectId = id || generatedId;

  const baseStyles: React.CSSProperties = {
    fontFamily: typography.fontFamily.system,
    color: colors.text.primary,
    borderRadius: variant === 'minimal' ? '0' : borderRadius.lg,
    transition: transitions.duration.normal,
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled ? 0.6 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
    appearance: 'none',
    backgroundImage: `url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")`,
    backgroundPosition: 'right 12px center',
    backgroundRepeat: 'no-repeat',
    backgroundSize: '16px',
    paddingRight: '40px',
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

  const selectStyles: React.CSSProperties = {
    ...baseStyles,
    ...(isFocused ? focusStyles : {}),
    ...(error && !isFocused ? errorStyles : {}),
  };

  return (
    <div style={containerStyles}>
      {label && (
        <label htmlFor={selectId} style={labelStyles}>
          {label}
        </label>
      )}

      <select
        id={selectId}
        style={selectStyles}
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
        value={props.value}
        onChange={props.onChange}
        name={props.name}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}

        {options
          ? options.map((option) => (
              <option
                key={option.value}
                value={option.value}
                disabled={option.disabled}
                style={{
                  background: colors.background.secondary,
                  color: colors.text.primary,
                  padding: spacing[2],
                }}
              >
                {option.label}
              </option>
            ))
          : children}
      </select>

      {(error || helperText) && (
        <span style={helperTextStyles}>{error || helperText}</span>
      )}
    </div>
  );
}

// Specialized select components
export function SizeSelect({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  placeholder,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  name,
}: Omit<SelectProps, 'options' | 'children'>) {
  const sizeOptions: SelectOption[] = [
    { value: 'sm', label: 'Small' },
    { value: 'md', label: 'Medium' },
    { value: 'lg', label: 'Large' },
  ];

  return (
    <Select
      size={size}
      variant={variant}
      label={label}
      error={error}
      helperText={helperText}
      placeholder={placeholder}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      id={id}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      name={name}
      options={sizeOptions}
    />
  );
}

export function ColorSelect({
  size = 'md',
  variant = 'default',
  label,
  error,
  helperText,
  placeholder,
  fullWidth = false,
  disabled,
  className = '',
  style,
  id,
  value,
  onChange,
  onFocus,
  onBlur,
  name,
}: Omit<SelectProps, 'options' | 'children'>) {
  const colorOptions: SelectOption[] = [
    { value: colors.accent.red, label: 'Red' },
    { value: colors.accent.orange, label: 'Orange' },
    { value: colors.accent.yellow, label: 'Yellow' },
    { value: colors.accent.green, label: 'Green' },
    { value: colors.accent.blue, label: 'Blue' },
    { value: colors.accent.purple, label: 'Purple' },
    { value: colors.white, label: 'White' },
    { value: colors.black, label: 'Black' },
  ];

  return (
    <Select
      size={size}
      variant={variant}
      label={label}
      error={error}
      helperText={helperText}
      placeholder={placeholder}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      id={id}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      name={name}
      options={colorOptions}
    />
  );
}

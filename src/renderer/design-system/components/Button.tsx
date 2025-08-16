import React from 'react';
import { colors, spacing, borderRadius, transitions } from '../tokens';

// Button variant types following shadcn/ui patterns
export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'outline'
  | 'link';

export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: React.ReactNode;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

// Variant style mappings
const variantStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: colors.primary.DEFAULT,
    color: colors.text.primary,
    border: `1px solid ${colors.primary.DEFAULT}`,
  },

  secondary: {
    background: colors.surface.default,
    color: colors.text.primary,
    border: `1px solid ${colors.border.emphasis}`,
  },

  ghost: {
    background: 'transparent',
    color: colors.text.primary,
    border: '1px solid transparent',
  },

  destructive: {
    background: colors.error,
    color: colors.text.primary,
    border: `1px solid ${colors.error}`,
  },

  outline: {
    background: 'transparent',
    color: colors.text.primary,
    border: `1px solid ${colors.border.emphasis}`,
  },

  link: {
    background: 'transparent',
    color: colors.primary.DEFAULT,
    border: 'none',
    textDecoration: 'underline',
    padding: '0',
  },
};

// Hover styles for each variant
const hoverStyles: Record<ButtonVariant, React.CSSProperties> = {
  primary: {
    background: colors.primary[600],
    borderColor: colors.primary[600],
  },

  secondary: {
    background: colors.surface.hover,
    borderColor: colors.border.emphasis,
  },

  ghost: {
    background: colors.surface.default,
  },

  destructive: {
    background: '#dc2626', // darker red
  },

  outline: {
    background: colors.surface.default,
  },

  link: {
    color: colors.primary[400],
  },
};

// Size style mappings
const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    height: '32px',
    padding: '0 12px',
    fontSize: '12px',
    fontWeight: 600,
  },

  md: {
    height: '36px',
    padding: '0 16px',
    fontSize: '14px',
    fontWeight: 600,
  },

  lg: {
    height: '40px',
    padding: '0 20px',
    fontSize: '16px',
    fontWeight: 600,
  },
};

export function Button({
  variant = 'secondary',
  size = 'md',
  children,
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  ...props
}: ButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);
  const [isPressed, setIsPressed] = React.useState(false);

  // Base button styles
  const baseStyles: React.CSSProperties = {
    appearance: 'none',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[2],
    borderRadius: borderRadius.xl,
    cursor: disabled || loading ? 'not-allowed' : 'pointer',
    transition: transitions.duration.normal,
    fontFamily: 'inherit',
    whiteSpace: 'nowrap',
    textAlign: 'center',
    userSelect: 'none',
    outline: 'none',
    width: fullWidth ? '100%' : 'auto',
    opacity: disabled || loading ? 0.6 : 1,
    transform: isPressed && !disabled && !loading ? 'translateY(1px)' : 'none',
    ...sizeStyles[size],
    ...variantStyles[variant],
    ...(isHovered && !disabled && !loading ? hoverStyles[variant] : {}),
    ...style,
  };

  // Focus styles
  const focusStyles: React.CSSProperties = {
    boxShadow: `0 0 0 2px ${colors.focus}`,
  };

  const handleMouseEnter = () => setIsHovered(true);
  const handleMouseLeave = () => {
    setIsHovered(false);
    setIsPressed(false);
  };
  const handleMouseDown = () => setIsPressed(true);
  const handleMouseUp = () => setIsPressed(false);

  return (
    <button
      type="button"
      style={baseStyles}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onFocus={(e) => {
        e.currentTarget.style.boxShadow = focusStyles.boxShadow!;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = 'none';
        props.onBlur?.(e);
      }}
      disabled={disabled || loading}
      className={className}
      onClick={props.onClick}
      onKeyDown={props.onKeyDown}
      tabIndex={props.tabIndex}
      id={props.id}
      aria-label={props['aria-label']}
    >
      {loading && (
        <div
          style={{
            width: '16px',
            height: '16px',
            border: `2px solid ${colors.text.primary}`,
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
          }}
        />
      )}

      {icon && iconPosition === 'left' && !loading && (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      )}

      {children}

      {icon && iconPosition === 'right' && !loading && (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      )}
    </button>
  );
}

// Export compound components for common patterns
export function PrimaryButton({
  children,
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  tabIndex,
  id,
  'aria-label': ariaLabel,
}: Omit<ButtonProps, 'variant'>) {
  return (
    <Button
      variant="primary"
      size={size}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      id={id}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

export function SecondaryButton({
  children,
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  tabIndex,
  id,
  'aria-label': ariaLabel,
}: Omit<ButtonProps, 'variant'>) {
  return (
    <Button
      variant="secondary"
      size={size}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      id={id}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

export function GhostButton({
  children,
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  tabIndex,
  id,
  'aria-label': ariaLabel,
}: Omit<ButtonProps, 'variant'>) {
  return (
    <Button
      variant="ghost"
      size={size}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      id={id}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

export function DestructiveButton({
  children,
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  tabIndex,
  id,
  'aria-label': ariaLabel,
}: Omit<ButtonProps, 'variant'>) {
  return (
    <Button
      variant="destructive"
      size={size}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      id={id}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

export function OutlineButton({
  children,
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  tabIndex,
  id,
  'aria-label': ariaLabel,
}: Omit<ButtonProps, 'variant'>) {
  return (
    <Button
      variant="outline"
      size={size}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      id={id}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

export function LinkButton({
  children,
  size = 'md',
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  disabled,
  className = '',
  style,
  onClick,
  onKeyDown,
  onFocus,
  onBlur,
  tabIndex,
  id,
  'aria-label': ariaLabel,
}: Omit<ButtonProps, 'variant'>) {
  return (
    <Button
      variant="link"
      size={size}
      loading={loading}
      icon={icon}
      iconPosition={iconPosition}
      fullWidth={fullWidth}
      disabled={disabled}
      className={className}
      style={style}
      onClick={onClick}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
      tabIndex={tabIndex}
      id={id}
      aria-label={ariaLabel}
    >
      {children}
    </Button>
  );
}

// Add keyframe animation for loading spinner
const style = document.createElement('style');
style.textContent = `
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

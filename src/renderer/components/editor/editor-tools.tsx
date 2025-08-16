import React from 'react';
import {
  colors,
  spacing,
  borderRadius,
  typography,
  transitions,
} from '../../design-system/tokens';

export interface ToolButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function ToolButton({
  label,
  active,
  onClick,
  icon,
  disabled = false,
  size = 'md',
}: ToolButtonProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const sizeStyles = {
    sm: {
      padding: '6px 10px',
      fontSize: typography.fontSize.xs,
      minWidth: '80px',
      height: '28px',
    },
    md: {
      padding: '8px 12px',
      fontSize: typography.fontSize.sm,
      minWidth: '96px',
      height: '32px',
    },
  };

  const baseStyles: React.CSSProperties = {
    appearance: 'none',
    background: active ? colors.surface.active : colors.surface.default,
    color: colors.text.primary,
    border: `1px solid ${colors.border.emphasis}`,
    borderRadius: borderRadius.xl,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontWeight: typography.fontWeight.semibold,
    textAlign: 'center',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing[1],
    whiteSpace: 'nowrap',
    transition: transitions.duration.normal,
    opacity: disabled ? 0.6 : 1,
    ...sizeStyles[size],
  };

  const hoverStyles: React.CSSProperties = {
    background: active ? colors.surface.active : colors.surface.hover,
    transform: 'translateY(-1px)',
  };

  const activeStyles: React.CSSProperties = {
    borderColor: colors.focus,
    boxShadow: `0 0 0 1px ${colors.focus}`,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...baseStyles,
        ...(isHovered && !disabled ? hoverStyles : {}),
        ...(active ? activeStyles : {}),
      }}
    >
      {icon && (
        <span style={{ display: 'flex', alignItems: 'center' }}>{icon}</span>
      )}
      {label}
    </button>
  );
}

export interface ColorSwatchProps {
  color: string;
  selected: boolean;
  onClick: () => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export function ColorSwatch({
  color,
  selected,
  onClick,
  size = 'md',
  disabled = false,
}: ColorSwatchProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const sizeStyles = {
    sm: { width: '18px', height: '18px' },
    md: { width: '22px', height: '22px' },
    lg: { width: '26px', height: '26px' },
  };

  const baseStyles: React.CSSProperties = {
    borderRadius: borderRadius.full,
    border: selected
      ? `2px solid ${colors.text.primary}`
      : `2px solid ${colors.border.muted}`,
    background: color,
    cursor: disabled ? 'not-allowed' : 'pointer',
    transition: transitions.duration.fast,
    opacity: disabled ? 0.6 : 1,
    boxShadow: selected ? '0 1px 3px rgba(0, 0, 0, 0.3)' : 'none',
    ...sizeStyles[size],
  };

  const hoverStyles: React.CSSProperties = {
    transform: 'scale(1.1)',
    border: `2px solid ${selected ? colors.text.primary : colors.border.emphasis}`,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={`Color ${color}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        ...baseStyles,
        ...(isHovered && !disabled ? hoverStyles : {}),
      }}
    />
  );
}

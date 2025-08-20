import React from 'react';
import { colors, spacing, borderRadius, shadows, zIndex } from '../tokens';

export type PanelVariant = 'default' | 'glass' | 'minimal' | 'elevated';
export type PanelSize = 'sm' | 'md' | 'lg' | 'xl';

export interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: PanelVariant;
  size?: PanelSize;
  padding?: keyof typeof spacing;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
  description?: string;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<PanelVariant, React.CSSProperties> = {
  default: {
    background: colors.surface.default,
    border: `1px solid ${colors.border.default}`,
    boxShadow: shadows.md,
  },

  glass: {
    background: colors.background.glass,
    border: `1px solid ${colors.border.default}`,
    backdropFilter: 'blur(10px)',
    WebkitBackdropFilter: 'blur(10px)',
    boxShadow: shadows.glass,
  },

  minimal: {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
  },

  elevated: {
    background: colors.surface.default,
    border: `1px solid ${colors.border.emphasis}`,
    boxShadow: shadows.xl,
  },
};

const sizeStyles: Record<PanelSize, { width: string; maxWidth: string }> = {
  sm: { width: '200px', maxWidth: '90vw' },
  md: { width: '280px', maxWidth: '90vw' },
  lg: { width: '360px', maxWidth: '90vw' },
  xl: { width: '480px', maxWidth: '95vw' },
};

export function Panel({
  variant = 'default',
  size = 'md',
  padding = 3,
  children,
  header,
  footer,
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  fullWidth = false,
  className = '',
  style,
  ...props
}: PanelProps) {
  const [isCollapsed, setIsCollapsed] = React.useState(defaultCollapsed);

  const baseStyles: React.CSSProperties = {
    borderRadius: borderRadius['3xl'],
    color: colors.text.primary,
    width: fullWidth ? '100%' : sizeStyles[size].width,
    maxWidth: sizeStyles[size].maxWidth,
    ...variantStyles[variant],
    ...style,
  };

  const contentStyles: React.CSSProperties = {
    padding: spacing[padding],
  };

  const headerStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: `${spacing[3]} ${spacing[padding]} ${spacing[2]} ${spacing[padding]}`,
    borderBottom:
      title || description ? `1px solid ${colors.border.muted}` : 'none',
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 700,
    color: colors.text.primary,
    margin: 0,
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: '12px',
    color: colors.text.muted,
    margin: `${spacing[1]} 0 0 0`,
  };

  const footerStyles: React.CSSProperties = {
    padding: `${spacing[2]} ${spacing[padding]} ${spacing[3]} ${spacing[padding]}`,
    borderTop: `1px solid ${colors.border.muted}`,
  };

  const collapseButtonStyles: React.CSSProperties = {
    background: 'none',
    border: 'none',
    color: colors.text.muted,
    cursor: 'pointer',
    padding: spacing[1],
    borderRadius: borderRadius.md,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    height: '24px',
    transition: 'color 0.2s ease',
  };

  const PanelElement = props.onClick ? 'button' : 'div';

  return (
    <PanelElement
      type={props.onClick ? 'button' : undefined}
      style={baseStyles}
      className={className}
      onClick={props.onClick as any}
      onMouseEnter={props.onMouseEnter as any}
      onMouseLeave={props.onMouseLeave as any}
      id={props.id}
      aria-label={props.onClick ? title || 'Interactive panel' : undefined}
    >
      {(title || description || header || collapsible) && (
        <div style={headerStyles}>
          <div style={{ flex: 1 }}>
            {title && <h3 style={titleStyles}>{title}</h3>}
            {description && <p style={descriptionStyles}>{description}</p>}
            {header}
          </div>

          {collapsible && (
            <button
              type="button"
              onClick={() => setIsCollapsed(!isCollapsed)}
              style={collapseButtonStyles}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = colors.text.secondary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = colors.text.muted;
              }}
              aria-label={isCollapsed ? 'Expand panel' : 'Collapse panel'}
              aria-expanded={!isCollapsed}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                style={{
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                }}
              >
                <path
                  d="M6 9l6 6 6-6"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      )}

      {!isCollapsed && <div style={contentStyles}>{children}</div>}

      {footer && !isCollapsed && <div style={footerStyles}>{footer}</div>}
    </PanelElement>
  );
}

// Specialized panel components
export function GlassPanel({
  children,
  size = 'md',
  padding = 3,
  header,
  footer,
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  id,
}: Omit<PanelProps, 'variant'>) {
  return (
    <Panel
      variant="glass"
      size={size}
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      id={id}
    >
      {children}
    </Panel>
  );
}

export function ElevatedPanel({
  children,
  size = 'md',
  padding = 3,
  header,
  footer,
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  id,
}: Omit<PanelProps, 'variant'>) {
  return (
    <Panel
      variant="elevated"
      size={size}
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      id={id}
    >
      {children}
    </Panel>
  );
}

export function MinimalPanel({
  children,
  size = 'md',
  padding = 3,
  header,
  footer,
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  id,
}: Omit<PanelProps, 'variant'>) {
  return (
    <Panel
      variant="minimal"
      size={size}
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      id={id}
    >
      {children}
    </Panel>
  );
}

// Floating panel for overlays and modals
export function FloatingPanel({
  position = 'center',
  children,
  variant = 'glass',
  size = 'md',
  padding = 3,
  header,
  footer,
  title,
  description,
  collapsible = false,
  defaultCollapsed = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  onMouseEnter,
  onMouseLeave,
  id,
}: PanelProps & {
  position?:
    | 'center'
    | 'top-left'
    | 'top-right'
    | 'bottom-left'
    | 'bottom-right';
}) {
  const positionStyles: Record<typeof position, React.CSSProperties> = {
    center: {
      position: 'fixed',
      top: '50%',
      left: '50%',
      transform: 'translate(-50%, -50%)',
      zIndex: zIndex.modal,
    },
    'top-left': {
      position: 'fixed',
      top: spacing[4],
      left: spacing[4],
      zIndex: zIndex.overlay,
    },
    'top-right': {
      position: 'fixed',
      top: spacing[4],
      right: spacing[4],
      zIndex: zIndex.overlay,
    },
    'bottom-left': {
      position: 'fixed',
      bottom: spacing[4],
      left: spacing[4],
      zIndex: zIndex.overlay,
    },
    'bottom-right': {
      position: 'fixed',
      bottom: spacing[4],
      right: spacing[4],
      zIndex: zIndex.overlay,
    },
  };

  return (
    <Panel
      variant={variant}
      size={size}
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      collapsible={collapsible}
      defaultCollapsed={defaultCollapsed}
      fullWidth={fullWidth}
      className={className}
      style={{ ...positionStyles[position], ...style }}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      id={id}
    >
      {children}
    </Panel>
  );
}

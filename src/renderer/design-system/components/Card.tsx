import React from 'react';
import { colors, spacing, borderRadius, shadows } from '../tokens';

export type CardVariant = 'default' | 'elevated' | 'outlined' | 'minimal';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  padding?: keyof typeof spacing;
  children: React.ReactNode;
  header?: React.ReactNode;
  footer?: React.ReactNode;
  title?: string;
  description?: string;
  image?: string;
  imageAlt?: string;
  hoverable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  fullWidth?: boolean;
}

const variantStyles: Record<CardVariant, React.CSSProperties> = {
  default: {
    background: colors.surface.default,
    border: `1px solid ${colors.border.default}`,
    boxShadow: shadows.sm,
  },

  elevated: {
    background: colors.surface.default,
    border: 'none',
    boxShadow: shadows.lg,
  },

  outlined: {
    background: 'transparent',
    border: `1px solid ${colors.border.emphasis}`,
    boxShadow: 'none',
  },

  minimal: {
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
  },
};

export function Card({
  variant = 'default',
  padding = 4,
  children,
  header,
  footer,
  title,
  description,
  image,
  imageAlt,
  hoverable = false,
  selectable = false,
  selected = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  ...props
}: CardProps) {
  const [isHovered, setIsHovered] = React.useState(false);

  const baseStyles: React.CSSProperties = {
    borderRadius: borderRadius['2xl'],
    color: colors.text.primary,
    transition: 'all 0.2s ease',
    cursor: onClick || selectable ? 'pointer' : 'default',
    width: fullWidth ? '100%' : 'auto',
    overflow: 'hidden',
    ...variantStyles[variant],
    ...style,
  };

  const hoverStyles: React.CSSProperties = hoverable
    ? {
        transform: 'translateY(-2px)',
        boxShadow: variant === 'elevated' ? shadows.xl : shadows.md,
      }
    : {};

  const selectedStyles: React.CSSProperties = selected
    ? {
        borderColor: colors.focus,
        boxShadow: `0 0 0 1px ${colors.focus}`,
      }
    : {};

  const cardStyles: React.CSSProperties = {
    ...baseStyles,
    ...(isHovered && hoverable ? hoverStyles : {}),
    ...(selected ? selectedStyles : {}),
  };

  const imageStyles: React.CSSProperties = {
    width: '100%',
    height: '200px',
    objectFit: 'cover',
    display: 'block',
  };

  const headerStyles: React.CSSProperties = {
    padding: `${spacing[4]} ${spacing[padding]} ${spacing[2]} ${spacing[padding]}`,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 600,
    color: colors.text.primary,
    margin: 0,
    marginBottom: spacing[1],
  };

  const descriptionStyles: React.CSSProperties = {
    fontSize: '14px',
    color: colors.text.muted,
    margin: 0,
    lineHeight: 1.5,
  };

  const contentStyles: React.CSSProperties = {
    padding: spacing[padding],
  };

  const footerStyles: React.CSSProperties = {
    padding: `${spacing[2]} ${spacing[padding]} ${spacing[4]} ${spacing[padding]}`,
    borderTop: `1px solid ${colors.border.muted}`,
  };

  const CardElement = onClick || selectable ? 'button' : 'div';

  return (
    <CardElement
      type={onClick || selectable ? 'button' : undefined}
      style={cardStyles}
      className={className}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick as any}
      id={props.id}
      aria-label={
        onClick || selectable ? title || 'Interactive card' : undefined
      }
    >
      {image && <img src={image} alt={imageAlt} style={imageStyles} />}

      {(title || description || header) && (
        <div style={headerStyles}>
          {title && <h3 style={titleStyles}>{title}</h3>}
          {description && <p style={descriptionStyles}>{description}</p>}
          {header}
        </div>
      )}

      <div style={contentStyles}>{children}</div>

      {footer && <div style={footerStyles}>{footer}</div>}
    </CardElement>
  );
}

// Specialized card components
export function ElevatedCard({
  children,
  padding = 4,
  header,
  footer,
  title,
  description,
  image,
  imageAlt,
  selectable = false,
  selected = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  id,
}: Omit<CardProps, 'variant' | 'hoverable'>) {
  return (
    <Card
      variant="elevated"
      hoverable
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      image={image}
      imageAlt={imageAlt}
      selectable={selectable}
      selected={selected}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick as any}
      id={id}
    >
      {children}
    </Card>
  );
}

export function OutlinedCard({
  children,
  padding = 4,
  header,
  footer,
  title,
  description,
  image,
  imageAlt,
  hoverable = false,
  selectable = false,
  selected = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  id,
}: Omit<CardProps, 'variant'>) {
  return (
    <Card
      variant="outlined"
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      image={image}
      imageAlt={imageAlt}
      hoverable={hoverable}
      selectable={selectable}
      selected={selected}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick as any}
      id={id}
    >
      {children}
    </Card>
  );
}

export function MinimalCard({
  children,
  padding = 4,
  header,
  footer,
  title,
  description,
  image,
  imageAlt,
  hoverable = false,
  selectable = false,
  selected = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  id,
}: Omit<CardProps, 'variant'>) {
  return (
    <Card
      variant="minimal"
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      image={image}
      imageAlt={imageAlt}
      hoverable={hoverable}
      selectable={selectable}
      selected={selected}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick as any}
      id={id}
    >
      {children}
    </Card>
  );
}

export function SelectableCard({
  children,
  variant = 'default',
  padding = 4,
  header,
  footer,
  title,
  description,
  image,
  imageAlt,
  selected = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  id,
}: Omit<CardProps, 'selectable' | 'hoverable'>) {
  return (
    <Card
      variant={variant}
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      image={image}
      imageAlt={imageAlt}
      selectable
      hoverable
      selected={selected}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick as any}
      id={id}
    >
      {children}
    </Card>
  );
}

// Card for displaying tools or actions
export function ActionCard({
  icon,
  label,
  shortcut,
  variant = 'outlined',
  padding = 3,
  header,
  footer,
  title,
  description,
  image,
  imageAlt,
  selectable = false,
  selected = false,
  fullWidth = false,
  className = '',
  style,
  onClick,
  id,
}: Omit<CardProps, 'children'> & {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
}) {
  return (
    <Card
      variant={variant}
      hoverable
      padding={padding}
      header={header}
      footer={footer}
      title={title}
      description={description}
      image={image}
      imageAlt={imageAlt}
      selectable={selectable}
      selected={selected}
      fullWidth={fullWidth}
      className={className}
      style={style}
      onClick={onClick as any}
      id={id}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: spacing[2],
          textAlign: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '40px',
            height: '40px',
            borderRadius: borderRadius.lg,
            background: colors.surface.muted,
            color: colors.text.secondary,
          }}
        >
          {icon}
        </div>

        <div>
          <div
            style={{
              fontSize: '14px',
              fontWeight: 500,
              color: colors.text.primary,
            }}
          >
            {label}
          </div>

          {shortcut && (
            <div
              style={{
                fontSize: '12px',
                color: colors.text.muted,
                marginTop: spacing[1],
              }}
            >
              {shortcut}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

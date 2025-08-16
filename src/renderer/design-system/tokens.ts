/**
 * Design Tokens for X-Shot
 * Centralized design system values inspired by shadcn/ui
 */

// Color System
export const colors = {
  // Semantic colors
  background: {
    primary: '#0b0b0c',
    secondary: '#111111',
    tertiary: '#1a1a1a',
    overlay: 'rgba(17, 17, 17, 0.85)',
    glass: 'rgba(17, 17, 17, 0.9)',
  },

  // Surface colors
  surface: {
    default: 'rgba(255, 255, 255, 0.08)',
    hover: 'rgba(255, 255, 255, 0.12)',
    active: 'rgba(255, 255, 255, 0.2)',
    muted: 'rgba(255, 255, 255, 0.05)',
  },

  // Border colors
  border: {
    default: 'rgba(255, 255, 255, 0.1)',
    emphasis: 'rgba(255, 255, 255, 0.2)',
    muted: 'rgba(255, 255, 255, 0.05)',
  },

  // Text colors
  text: {
    primary: '#ffffff',
    secondary: 'rgba(255, 255, 255, 0.8)',
    muted: 'rgba(255, 255, 255, 0.6)',
    inverse: '#000000',
  },

  // Brand colors
  primary: {
    50: '#eff6ff',
    100: '#dbeafe',
    200: '#bfdbfe',
    300: '#93c5fd',
    400: '#60a5fa',
    500: '#3b82f6',
    600: '#2563eb',
    700: '#1d4ed8',
    800: '#1e40af',
    900: '#1e3a8a',
    950: '#172554',
    DEFAULT: '#4f46e5',
  },

  // Accent colors for tools and highlights
  accent: {
    red: '#ef4444',
    orange: '#f59e0b',
    yellow: '#eab308',
    green: '#22c55e',
    blue: '#3b82f6',
    purple: '#8b5cf6',
    pink: '#ec4899',
  },

  // Semantic status colors
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Selection and interaction
  selection: '#60a5fa',
  focus: '#3b82f6',

  // Transparent variants
  white: '#ffffff',
  black: '#000000',
  transparent: 'transparent',
} as const;

// Typography Scale
export const typography = {
  fontFamily: {
    system:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif',
    mono: '"Menlo", "Monaco", "Courier New", monospace',
  },

  fontSize: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    md: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '28px',
    '4xl': '32px',
    '5xl': '48px',
  },

  fontWeight: {
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },

  lineHeight: {
    none: 1,
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.75,
  },

  letterSpacing: {
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
  },
} as const;

// Spacing Scale (4px base grid)
export const spacing = {
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  10: '40px',
  12: '48px',
  16: '64px',
  20: '80px',
  24: '96px',
  32: '128px',
  40: '160px',
  48: '192px',
  56: '224px',
  64: '256px',
} as const;

// Border Radius
export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '6px',
  lg: '8px',
  xl: '10px',
  '2xl': '12px',
  '3xl': '14px',
  '4xl': '16px',
  full: '9999px',
} as const;

// Shadows
export const shadows = {
  none: 'none',
  sm: '0 1px 2px rgba(0, 0, 0, 0.05)',
  md: '0 4px 6px rgba(0, 0, 0, 0.1)',
  lg: '0 10px 15px rgba(0, 0, 0, 0.1)',
  xl: '0 20px 25px rgba(0, 0, 0, 0.1)',
  '2xl': '0 25px 50px rgba(0, 0, 0, 0.25)',
  glass: '0 8px 32px rgba(0, 0, 0, 0.1)',
  selection: '0 1px 3px rgba(0, 0, 0, 0.3)',
} as const;

// Z-Index Scale
export const zIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  overlay: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
  toast: 80,
  max: 9999,
} as const;

// Animation & Transitions
export const transitions = {
  duration: {
    fast: '150ms',
    normal: '200ms',
    slow: '300ms',
  },

  easing: {
    linear: 'linear',
    out: 'cubic-bezier(0, 0, 0.2, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

// Breakpoints for responsive design
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// Component-specific tokens
export const components = {
  button: {
    height: {
      sm: '32px',
      md: '36px',
      lg: '40px',
    },
    padding: {
      sm: '6px 12px',
      md: '8px 16px',
      lg: '10px 20px',
    },
  },

  input: {
    height: {
      sm: '32px',
      md: '36px',
      lg: '40px',
    },
    padding: '6px 12px',
  },

  panel: {
    padding: spacing[3],
    borderRadius: borderRadius['3xl'],
  },
} as const;

// Type exports for TypeScript
export type Colors = typeof colors;
export type Typography = typeof typography;
export type Spacing = typeof spacing;
export type BorderRadius = typeof borderRadius;
export type Shadows = typeof shadows;
export type ZIndex = typeof zIndex;
export type Transitions = typeof transitions;
export type Breakpoints = typeof breakpoints;
export type Components = typeof components;

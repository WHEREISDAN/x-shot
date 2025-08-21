/**
 * X-Shot Design System
 *
 * A comprehensive design system inspired by shadcn/ui with consistent
 * styling, proper TypeScript support, and accessibility features.
 */

// Design tokens
export * from './tokens';

// Core components
export * from './components/Button';
export * from './components/Input';
export * from './components/Select';
export * from './components/Panel';
export * from './components/Card';

// Design system utilities
export const designSystem = {
  version: '1.0.0',

  colors: {
    primary: '#4f46e5',
    success: '#22c55e',
    warning: '#f59e0b',
    error: '#ef4444',
    surface: 'rgba(255, 255, 255, 0.08)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: '#ffffff',
  },

  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '20px',
    xxl: '24px',
  },

  borderRadius: {
    sm: '4px',
    md: '8px',
    lg: '12px',
    xl: '16px',
  },

  fontSize: {
    xs: '10px',
    sm: '12px',
    base: '14px',
    lg: '16px',
    xl: '18px',
  },
} as const;

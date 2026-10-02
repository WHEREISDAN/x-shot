import { useEffect } from 'react';
import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
  zIndex,
} from '../design-system/tokens';

export type ToastTone = 'success' | 'error';

interface ToastProps {
  tone: ToastTone;
  message: string;
  onDismiss: () => void;
  dismissLabel?: string;
  /** Hides the toast after this many milliseconds; omit to keep it. */
  autoDismissMs?: number;
}

export default function Toast({
  tone,
  message,
  onDismiss,
  dismissLabel = 'Dismiss',
  autoDismissMs,
}: ToastProps) {
  useEffect(() => {
    if (autoDismissMs === undefined) return () => {};
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  return (
    <div
      // Errors interrupt; confirmations are announced politely.
      role={tone === 'error' ? 'alert' : 'status'}
      style={{
        position: 'fixed',
        top: spacing[12],
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: zIndex.toast,
        display: 'flex',
        alignItems: 'flex-start',
        gap: spacing[3],
        maxWidth: 560,
        padding: `${spacing[3]} ${spacing[4]}`,
        background: colors.background.glass,
        border: `1px solid ${tone === 'error' ? colors.error : colors.success}`,
        borderRadius: borderRadius['2xl'],
        boxShadow: shadows['2xl'],
        color: colors.text.primary,
        fontFamily: typography.fontFamily.system,
        fontSize: typography.fontSize.sm,
        lineHeight: typography.lineHeight.normal,
        overflowWrap: 'anywhere',
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        aria-label={dismissLabel}
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: colors.text.muted,
          cursor: 'pointer',
          fontSize: typography.fontSize.md,
          lineHeight: typography.lineHeight.none,
          padding: 0,
        }}
      >
        ×
      </button>
    </div>
  );
}

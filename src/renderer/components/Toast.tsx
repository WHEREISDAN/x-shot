import {
  borderRadius,
  colors,
  shadows,
  spacing,
  typography,
  zIndex,
} from '../design-system/tokens';

interface CaptureErrorToastProps {
  message: string;
  onDismiss: () => void;
}

export default function CaptureErrorToast({
  message,
  onDismiss,
}: CaptureErrorToastProps) {
  return (
    <div
      role="alert"
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
        border: `1px solid ${colors.error}`,
        borderRadius: borderRadius['2xl'],
        boxShadow: shadows['2xl'],
        color: colors.text.primary,
        fontFamily: typography.fontFamily.system,
        fontSize: typography.fontSize.sm,
        lineHeight: typography.lineHeight.normal,
      }}
    >
      <span style={{ flex: 1 }}>{message}</span>
      <button
        type="button"
        aria-label="Dismiss capture error"
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

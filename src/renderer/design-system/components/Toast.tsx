import { useEffect } from 'react';
import { Check, TriangleAlert, X } from 'lucide-react';
import { Button } from './Button';
import { IconButton } from './IconButton';
import { Island } from './Island';
import cx from '../class-names';
import styles from './Toast.module.css';

export type ToastTone = 'success' | 'error';

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastProps {
  tone: ToastTone;
  message: string;
  onDismiss: () => void;
  action?: ToastAction;
  dismissLabel?: string;
  /** Hides the toast after this many milliseconds; omit to keep it. */
  autoDismissMs?: number;
  className?: string;
}

/** A message at the top centre: icon, text, an optional action, dismiss. */
export function Toast({
  tone,
  message,
  onDismiss,
  dismissLabel = 'Dismiss',
  autoDismissMs,
  action,
  className,
}: ToastProps) {
  useEffect(() => {
    if (autoDismissMs === undefined) return () => {};
    const timer = setTimeout(onDismiss, autoDismissMs);
    return () => clearTimeout(timer);
  }, [autoDismissMs, onDismiss]);

  return (
    <Island
      // Errors interrupt; confirmations are announced politely.
      role={tone === 'error' ? 'alert' : 'status'}
      className={cx(styles.toast, className)}
    >
      <span
        className={cx(
          styles.icon,
          tone === 'error' ? styles.error : styles.success,
        )}
        aria-hidden
      >
        {tone === 'error' ? <TriangleAlert /> : <Check />}
      </span>
      <span className={styles.message}>{message}</span>
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
      <IconButton
        label={dismissLabel}
        size="sm"
        icon={<X />}
        onClick={onDismiss}
      />
    </Island>
  );
}

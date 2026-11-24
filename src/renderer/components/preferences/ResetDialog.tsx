import { Button, Island } from '../../design-system';
import styles from './ResetDialog.module.css';

interface ResetDialogProps {
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks before every preference goes back to its default. */
export default function ResetDialog({ onCancel, onConfirm }: ResetDialogProps) {
  return (
    <div
      className={styles.scrim}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reset-title"
      aria-describedby="reset-text"
    >
      <Island className={styles.dialog}>
        <h2 id="reset-title" className={styles.title}>
          Reset preferences?
        </h2>
        <p id="reset-text" className={styles.text}>
          Are you sure you want to reset all preferences to defaults? This
          cannot be undone.
        </p>
        <div className={styles.actions}>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="danger" onClick={onConfirm}>
            Reset
          </Button>
        </div>
      </Island>
    </div>
  );
}

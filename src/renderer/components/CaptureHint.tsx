import { KeyCap } from '../design-system';
import styles from './CaptureHint.module.css';

/** How to start, shown until there is a selection or a panel opens. */
export default function CaptureHint() {
  return (
    <p className={styles.hint} data-capture-hint="1">
      Drag to select an area
      <KeyCap>Esc</KeyCap>
      to cancel
    </p>
  );
}

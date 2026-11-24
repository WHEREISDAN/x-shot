import cx from '../class-names';
import { acceleratorKeys } from '../format-accelerator';
import styles from './KeyCap.module.css';

export interface KeyCapProps {
  children: string;
  className?: string;
}

/** One key, drawn as a key cap. */
export function KeyCap({ children, className }: KeyCapProps) {
  return <kbd className={cx(styles.key, className)}>{children}</kbd>;
}

export interface HotkeyProps {
  /** An Electron accelerator, e.g. `CommandOrControl+Shift+1`. */
  accelerator: string;
  /** Defaults to the platform the app runs on. */
  mac?: boolean;
  className?: string;
}

/** A shortcut as key caps, read out by key name. */
export function Hotkey({ accelerator, mac, className }: HotkeyProps) {
  const keys = acceleratorKeys(accelerator, mac);
  return (
    <kbd className={cx(styles.hotkey, className)}>
      <span className={styles.keys} aria-hidden>
        {keys.map((k, index) => (
          // Keys may repeat, so their place in the shortcut is the key.
          // eslint-disable-next-line react/no-array-index-key
          <KeyCap key={index}>{k.label}</KeyCap>
        ))}
      </span>
      <span className={styles.readable}>
        {keys.map((k) => k.name).join(' ')}
      </span>
    </kbd>
  );
}

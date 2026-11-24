import { useEffect, useState } from 'react';
import { Hotkey, Logo } from '../design-system';
import styles from './EmptyState.module.css';

/** The capture hotkey from the stored preferences, once they are read. */
function useCaptureHotkey(): string | null {
  const [hotkey, setHotkey] = useState<string | null>(null);
  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return;
    api
      .invoke('get-preferences', {})
      .then((preferences) => setHotkey(preferences?.capture?.hotkey ?? null))
      .catch(() => {});
  }, []);
  return hotkey;
}

/** The editor before a capture arrives. */
export default function EmptyState() {
  const hotkey = useCaptureHotkey();
  return (
    <div className={styles.canvas}>
      <div className={styles.box}>
        <Logo size={26} />
        Waiting for screenshot…
        {hotkey && <Hotkey accelerator={hotkey} />}
      </div>
    </div>
  );
}

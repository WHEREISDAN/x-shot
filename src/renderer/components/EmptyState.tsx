import { useEffect, useState } from 'react';
import icon from '../../../assets/icon.png';
import { Hotkey } from '../design-system';
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
        <img src={icon} alt="" width={36} height={36} className={styles.logo} />
        Waiting for screenshot…
        {hotkey && <Hotkey accelerator={hotkey} />}
      </div>
    </div>
  );
}

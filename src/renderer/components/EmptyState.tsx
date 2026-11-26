import { useEffect, useState } from 'react';
import { Settings } from 'lucide-react';
import icon from '../../../assets/icon.png';
import { Hotkey, IconButton, Island } from '../design-system';
import openPreferencesWindow from '../utils/open-preferences';
import styles from './EmptyState.module.css';

/** The capture hotkey from the stored preferences, once they are read. */
function useCaptureHotkey(): string | null {
  const [hotkey, setHotkey] = useState<string | null>(null);
  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return () => {};
    let active = true;
    api
      .invoke('get-preferences', {})
      .then((preferences) => {
        if (active) setHotkey(preferences?.capture?.hotkey ?? null);
        return preferences;
      })
      .catch(() => {});
    const unsubscribe =
      typeof api.on === 'function'
        ? api.on('preferences-changed', (preferences) => {
            if (active) setHotkey(preferences?.capture?.hotkey ?? null);
          })
        : undefined;
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);
  return hotkey;
}

/** The editor before a capture arrives. */
export default function EmptyState() {
  const hotkey = useCaptureHotkey();
  return (
    <div className={styles.canvas}>
      <Island layout="bar" className={styles.actions}>
        <IconButton
          label="Preferences"
          icon={<Settings />}
          onClick={openPreferencesWindow}
          tooltipAlign="end"
        />
      </Island>
      <div className={styles.box}>
        <img src={icon} alt="" width={36} height={36} className={styles.logo} />
        Waiting for screenshot…
        {hotkey && <Hotkey accelerator={hotkey} />}
      </div>
    </div>
  );
}

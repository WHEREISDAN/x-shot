import { useCallback, useEffect, useState } from 'react';
import type { WindowState } from '../../shared/ipc-types';
import { isMacPlatform, Logo } from '../design-system';
import cx from '../design-system/class-names';
import styles from './TitleBar.module.css';

interface TitleBarProps {
  title: string;
  /** Shown after the title in mono, e.g. the capture's pixel size. */
  detail?: string;
}

export default function TitleBar({ title, detail }: TitleBarProps) {
  const [state, setState] = useState<WindowState | null>(null);

  useEffect(() => {
    const api = window?.electron?.windowControls;
    if (!api) return () => {};
    api
      .getState()
      .then(setState)
      .catch(() => {});
    const off = api.onState((s) => setState(s));
    return off;
  }, []);

  const mac = state ? state.platform === 'darwin' : isMacPlatform();

  const handleDoubleClick = useCallback(() => {
    const api = window?.electron?.windowControls;
    api?.toggleMaximize();
  }, []);

  return (
    <div
      className={cx(styles.titleBar, mac && styles.mac)}
      onDoubleClick={handleDoubleClick}
    >
      <Logo className={styles.logo} />
      <span>{title}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </div>
  );
}

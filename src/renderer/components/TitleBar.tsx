import React, { useCallback, useEffect, useMemo, useState } from 'react';
import icon from '../../../assets/icon.png';
import type { WindowState } from '../../shared/ipc-types';

export default function TitleBar() {
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

  const isMac = state?.platform === 'darwin';

  const handleDoubleClick = useCallback(() => {
    const api = window?.electron?.windowControls;
    api?.toggleMaximize();
  }, []);

  const containerStyle = useMemo<React.CSSProperties>(
    () => ({
      height: 36,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '10px 24px',
      background: 'rgb(17, 17, 17)',
      color: '#ffffff',
      borderBottom: '1px solid rgba(255,255,255,0.1)',
      WebkitUserSelect: 'none',
      WebkitAppRegion: 'drag',
    }),
    [],
  );

  const leftStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      paddingLeft: isMac ? 56 : 0,
      opacity: 0.9,
    }),
    [isMac],
  );

  const rightStyle = useMemo<React.CSSProperties>(
    () => ({
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      WebkitAppRegion: 'no-drag',
    }),
    [],
  );

  return (
    <div style={containerStyle} onDoubleClick={handleDoubleClick}>
      <div style={leftStyle}>
        <img
          src={icon}
          alt="X-Shot"
          width={16}
          height={16}
          style={{ filter: 'grayscale(100%) brightness(200%)', opacity: 0.8 }}
        />
        {/* <span style={{ fontSize: 12, fontWeight: 600 }}>X‑Shot</span> */}
      </div>
      <div style={rightStyle}>
        {/* Intentionally empty: we use native caption buttons provided by titleBarOverlay */}
      </div>
    </div>
  );
}

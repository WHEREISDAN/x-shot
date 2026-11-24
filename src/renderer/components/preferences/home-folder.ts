import { useEffect, useState } from 'react';

/**
 * A path inside the home folder written from `~`, as macOS and Linux show
 * it. Windows homes are not POSIX paths, so Windows paths stay as they are.
 */
export function tildePath(path: string, home: string | null): string {
  if (!home || !home.startsWith('/') || home === '/') return path;
  const base = home.endsWith('/') ? home.slice(0, -1) : home;
  if (path === base) return '~';
  if (path.startsWith(`${base}/`)) return `~${path.slice(base.length)}`;
  return path;
}

/** The user's home folder from main, or null until it arrives. */
export function useHomeFolder(): string | null {
  const [home, setHome] = useState<string | null>(null);
  useEffect(() => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return undefined;
    let current = true;
    const load = async () => {
      const folder = await api.invoke('get-home-folder', undefined);
      if (current && typeof folder === 'string') setHome(folder);
    };
    load().catch(() => {});
    return () => {
      current = false;
    };
  }, []);
  return home;
}

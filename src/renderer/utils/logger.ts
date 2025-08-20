import type { LogLevel } from '../../shared/ipc-types';

export function createRendererLogger(scope: string) {
  const send = (level: LogLevel, message: string, meta?: unknown) => {
    try {
      window.electron?.ipcRenderer?.log({ level, message, scope, meta });
    } catch {
      // Fallback to console if preload not ready
      // Keep minimal to avoid console noise
      // eslint-disable-next-line no-console
      (console[level] || console.log)(`[${scope}] ${message}`, meta ?? '');
    }
  };
  return {
    debug(message: string, meta?: unknown) {
      send('debug', message, meta);
    },
    info(message: string, meta?: unknown) {
      send('info', message, meta);
    },
    warn(message: string, meta?: unknown) {
      send('warn', message, meta);
    },
    error(message: string, meta?: unknown) {
      send('error', message, meta);
    },
  } as const;
}

export type RendererLogger = ReturnType<typeof createRendererLogger>;

export const logger = createRendererLogger('renderer');

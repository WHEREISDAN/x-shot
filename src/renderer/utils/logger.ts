import type { LogLevel } from '../../shared/ipc-types';

function safeConsoleLog(
  level: LogLevel,
  scope: string,
  message: string,
  meta?: unknown,
) {
  const ctxConsole = (
    window as unknown as {
      console?: typeof console;
    }
  ).console;
  if (!ctxConsole) return;

  // Only log in non-production environments
  if (process.env.NODE_ENV === 'production') return;

  const isKnownLevel = level in ctxConsole;
  const logFunction = (
    ctxConsole as unknown as Record<
      string,
      (msg?: unknown, ...args: unknown[]) => void
    >
  )[isKnownLevel ? (level as string) : 'log'] as (
    msg?: unknown,
    ...args: unknown[]
  ) => void;

  logFunction.call(ctxConsole, `[${scope}] ${message}`, meta ?? '');
}

export function createRendererLogger(scope: string) {
  const send = (level: LogLevel, message: string, meta?: unknown) => {
    try {
      window.electron?.ipcRenderer?.log({ level, message, scope, meta });
    } catch {
      safeConsoleLog(level, scope, message, meta);
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

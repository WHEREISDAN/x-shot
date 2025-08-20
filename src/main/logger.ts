import log from 'electron-log';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Configure transports once
log.transports.file.level = (process.env.LOG_LEVEL as any) || 'info';
log.transports.console.level = (process.env.LOG_LEVEL as any) || 'info';

function formatMeta(meta: unknown): unknown {
  if (meta === undefined || meta === null) return '';
  return meta;
}

export function getLogger(scope: string) {
  const prefix = `[${scope}]`;
  return {
    debug(message: string, meta?: unknown) {
      log.debug(`${prefix} ${message}`, formatMeta(meta));
    },
    info(message: string, meta?: unknown) {
      log.info(`${prefix} ${message}`, formatMeta(meta));
    },
    warn(message: string, meta?: unknown) {
      log.warn(`${prefix} ${message}`, formatMeta(meta));
    },
    error(message: string, meta?: unknown) {
      log.error(`${prefix} ${message}`, formatMeta(meta));
    },
  } as const;
}

export default { getLogger };

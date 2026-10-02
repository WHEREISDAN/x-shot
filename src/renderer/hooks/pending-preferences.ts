type Flush = () => Promise<unknown>;

const flushes = new Set<Flush>();

/**
 * Registers a preferences writer's flush so main can save its pending
 * changes before the window closes or the app quits.
 */
export function registerPreferencesFlush(flush: Flush): () => void {
  flushes.add(flush);
  return () => {
    flushes.delete(flush);
  };
}

/** Saves every registered writer's pending changes. */
export async function flushPendingPreferences(): Promise<void> {
  await Promise.all(
    [...flushes].map((flush) => flush().catch(() => undefined)),
  );
}

/**
 * Answers main's 'flush-preferences' requests for this window once its
 * pending changes are saved. Installed once per window at startup.
 */
export function installPreferencesFlushListener(): () => void {
  const api = window.electron?.ipcRenderer;
  if (!api) return () => {};
  return api.on('flush-preferences', ({ requestId }) => {
    flushPendingPreferences()
      .catch(() => undefined)
      .then(() => api.sendMessage('preferences-flushed', { requestId }))
      .catch(() => undefined);
  });
}

/** Opens or focuses the Preferences window via main IPC. */
export default function openPreferencesWindow(): void {
  window?.electron?.ipcRenderer
    ?.invoke('open-preferences-window', undefined)
    .catch(() => {});
}

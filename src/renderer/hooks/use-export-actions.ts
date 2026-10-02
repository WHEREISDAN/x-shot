import { useCallback, useState } from 'react';
import type { ToastTone } from '../components/Toast';
import { createRendererLogger } from '../utils/logger';

const logger = createRendererLogger('export-actions');

export const SUCCESS_TOAST_MS = 2000;

export interface ExportNotice {
  id: number;
  tone: ToastTone;
  message: string;
}

export type ExportAction = 'copy' | 'save';

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Copy and save through main, reporting each real outcome as a notice:
 * success briefly, failure until dismissed. Canceling a save is silent.
 */
export function useExportActions() {
  const [notice, setNotice] = useState<ExportNotice | null>(null);

  const show = useCallback((tone: ToastTone, message: string) => {
    setNotice({ id: Date.now(), tone, message });
  }, []);
  const dismissNotice = useCallback(() => setNotice(null), []);

  const copy = useCallback(
    async (dataUrl: string): Promise<boolean> => {
      const api = window?.electron?.ipcRenderer;
      if (!api) return false;
      try {
        const result = await api.invoke('copy-image', { dataUrl });
        if (result.ok) {
          show('success', 'Copied to the clipboard.');
          return true;
        }
        show('error', `Couldn't copy the screenshot: ${result.error}`);
      } catch (error) {
        show('error', `Couldn't copy the screenshot: ${messageOf(error)}`);
      }
      return false;
    },
    [show],
  );

  const save = useCallback(
    async (dataUrl: string): Promise<void> => {
      const api = window?.electron?.ipcRenderer;
      if (!api) return;
      try {
        const result = await api.invoke('save-image', { dataUrl });
        if (result.status === 'saved') {
          show('success', `Saved to ${result.filePath}`);
        } else if (result.status === 'failed') {
          show('error', `Couldn't save the screenshot: ${result.error}`);
        }
      } catch (error) {
        show('error', `Couldn't save the screenshot: ${messageOf(error)}`);
      }
    },
    [show],
  );

  /** For failures before main is involved, such as rendering the export. */
  const reportExportError = useCallback(
    (action: ExportAction, error: unknown) => {
      logger.error('Export failed', { action, message: messageOf(error) });
      show('error', `Couldn't ${action} the screenshot: ${messageOf(error)}`);
    },
    [show],
  );

  return { notice, dismissNotice, copy, save, reportExportError };
}

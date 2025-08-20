import { ElectronHandler } from '../main/preload';
import type { LogMessage } from '../shared/ipc-types';

declare global {
  interface Window {
    electron: ElectronHandler & {
      ipcRenderer: ElectronHandler['ipcRenderer'] & {
        log(payload: LogMessage): void;
      };
    };
  }
}

export {};

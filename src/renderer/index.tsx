import { createRoot } from 'react-dom/client';
import App from './App';
import { createRendererLogger } from './utils/logger';

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);

// calling IPC exposed from preload script
const bootLogger = createRendererLogger('bootstrap');
window.electron?.ipcRenderer.once('ipc-example', (arg) => {
  bootLogger.info(String(arg));
});
window.electron?.ipcRenderer.sendMessage('ipc-example', ['ping']);

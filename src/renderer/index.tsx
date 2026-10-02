import { createRoot } from 'react-dom/client';
import App from './App';
import { installPreferencesFlushListener } from './hooks/pending-preferences';

installPreferencesFlushListener();

const container = document.getElementById('root') as HTMLElement;
const root = createRoot(container);
root.render(<App />);

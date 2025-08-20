import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import type { ScreenshotResult } from '../shared/ipc-types';
import ScreenshotCapture from './ScreenshotCapture';
import './App.css';
import ScreenshotEditor from './components/editor/ScreenshotEditor';
import TitleBar from './components/TitleBar';
import PreferencesWindow from './components/preferences/PreferencesWindow';
import { checkAndMigrateIfNeeded } from './utils/migrate-preferences';
import { createRendererLogger } from './utils/logger';

const logger = createRendererLogger('app');

function Hello() {
  const [screenshotData, setScreenshotData] = useState<ScreenshotResult | null>(
    null,
  );

  useEffect(() => {
    // Run migration check on app load
    checkAndMigrateIfNeeded();

    // Listen for screenshot data if bridge is available (not in tests)
    const api = window?.electron?.ipcRenderer;
    if (!api) return () => {};
    const unsubscribe = api.on('screenshot-data', async (data) => {
      setScreenshotData(data);

      // Check if auto-copy is enabled and copy to clipboard
      try {
        const preferences = await api.invoke('get-preferences', {});
        if (preferences?.capture?.autoCopyToClipboard && data.imageDataUrl) {
          await api.invoke('copy-image', { dataUrl: data.imageDataUrl });
        }
      } catch (error) {
        logger.warn('Failed to auto-copy screenshot', error);
      }
    });
    return unsubscribe;
  }, []);

  const handleNewScreenshot = () => {
    setScreenshotData(null);
  };

  const handleCopy = useCallback(async (dataUrl: string) => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return false;
    try {
      const ok = await api.invoke('copy-image', { dataUrl });
      return ok;
    } catch {
      return false;
    }
  }, []);

  const handleSave = useCallback(async (dataUrl: string) => {
    const api = window?.electron?.ipcRenderer;
    if (!api) return;
    await api.invoke('save-image', { dataUrl });
  }, []);

  return (
    <div className="app-container">
      {screenshotData && screenshotData.imageDataUrl ? (
        <ScreenshotEditor
          screenshot={screenshotData}
          onDelete={handleNewScreenshot}
          onCopy={handleCopy}
          onSave={handleSave}
        />
      ) : (
        <div
          style={{
            flex: 1,
            display: 'flex',
            background: '#0b0b0c',
            color: 'white',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ opacity: 0.6, fontSize: 12 }}>
            Waiting for screenshot…
          </div>
        </div>
      )}
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const hideTitleBar = location.pathname === '/screenshot';
  return (
    <div className="app-container">
      {!hideTitleBar && <TitleBar />}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Shell>
        <Routes>
          <Route path="/" element={<Hello />} />
          <Route path="/screenshot" element={<ScreenshotCapture />} />
          <Route path="/preferences" element={<PreferencesWindow />} />
        </Routes>
      </Shell>
    </Router>
  );
}

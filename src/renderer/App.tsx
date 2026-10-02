import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useCallback, useEffect, type ReactNode } from 'react';
import ScreenshotCapture from './ScreenshotCapture';
import './App.css';
import ScreenshotEditor from './components/editor/ScreenshotEditor';
import CaptureErrorToast from './components/CaptureErrorToast';
import TitleBar from './components/TitleBar';
import PreferencesWindow from './components/preferences/PreferencesWindow';
import { checkAndMigrateIfNeeded } from './utils/migrate-preferences';
import { useCaptureResult } from './hooks/use-capture-result';
import removeLegacyPiiMaskKeys from './hooks/pii/legacy-mask-storage';

function Hello() {
  const { screenshot, failure, dismissFailure, clearScreenshot } =
    useCaptureResult();

  useEffect(() => {
    checkAndMigrateIfNeeded();
    removeLegacyPiiMaskKeys();
  }, []);

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
      {failure && (
        <CaptureErrorToast
          key={failure.sessionId}
          message={failure.message}
          onDismiss={dismissFailure}
        />
      )}
      {screenshot ? (
        // Keyed by session so every capture starts with a fresh editor:
        // shapes, selection, undo history, text editing and OCR state.
        <ScreenshotEditor
          key={screenshot.sessionId}
          screenshot={screenshot}
          onDelete={clearScreenshot}
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

import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import ScreenshotCapture from './ScreenshotCapture';
import './App.css';
import ScreenshotEditor from './components/editor/ScreenshotEditor';
import Toast from './components/Toast';
import TitleBar from './components/TitleBar';
import PreferencesWindow from './components/preferences/PreferencesWindow';
import { checkAndMigrateIfNeeded } from './utils/migrate-preferences';
import { useCaptureResult } from './hooks/use-capture-result';
import { SUCCESS_TOAST_MS, useExportActions } from './hooks/use-export-actions';
import removeLegacyPiiMaskKeys from './hooks/pii/legacy-mask-storage';

function Hello() {
  const { screenshot, failure, dismissFailure, clearScreenshot } =
    useCaptureResult();
  const { notice, dismissNotice, copy, save, reportExportError } =
    useExportActions();

  // A newer capture failure replaces an older copy or save message.
  useEffect(() => {
    if (failure) dismissNotice();
  }, [failure, dismissNotice]);

  useEffect(() => {
    checkAndMigrateIfNeeded();
    removeLegacyPiiMaskKeys();
  }, []);

  return (
    <div className="app-container">
      {notice && (
        <Toast
          key={notice.id}
          tone={notice.tone}
          message={notice.message}
          onDismiss={dismissNotice}
          autoDismissMs={
            notice.tone === 'success' ? SUCCESS_TOAST_MS : undefined
          }
        />
      )}
      {failure && !notice && (
        <Toast
          key={failure.sessionId}
          tone="error"
          message={failure.message}
          onDismiss={dismissFailure}
          dismissLabel="Dismiss capture error"
        />
      )}
      {screenshot ? (
        // Keyed by session so every capture starts with a fresh editor:
        // shapes, selection, undo history, text editing and OCR state.
        <ScreenshotEditor
          key={screenshot.sessionId}
          screenshot={screenshot}
          onDelete={clearScreenshot}
          onCopy={copy}
          onSave={save}
          onExportError={reportExportError}
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

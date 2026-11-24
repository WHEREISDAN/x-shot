import {
  HashRouter as Router,
  Routes,
  Route,
  useLocation,
} from 'react-router-dom';
import { useEffect, type ReactNode } from 'react';
import { LucideProvider } from 'lucide-react';
import '@fontsource-variable/geist/index.css';
import '@fontsource-variable/geist-mono/index.css';
import ScreenshotCapture from './ScreenshotCapture';
import './App.css';
import styles from './App.module.css';
import ScreenshotEditor from './components/editor/ScreenshotEditor';
import EmptyState from './components/EmptyState';
import { Toast, type ToastAction } from './design-system';
import cx from './design-system/class-names';
import type { CaptureFailure } from '../shared/ipc-types';
import TitleBar from './components/TitleBar';
import PreferencesWindow from './components/preferences/PreferencesWindow';
import { checkAndMigrateIfNeeded } from './utils/migrate-preferences';
import { useCaptureResult } from './hooks/use-capture-result';
import { SUCCESS_TOAST_MS, useExportActions } from './hooks/use-export-actions';
import removeLegacyPiiMaskKeys from './hooks/pii/legacy-mask-storage';

function failureAction(failure: CaptureFailure): ToastAction | undefined {
  if (failure.action !== 'open-screen-recording-settings') return undefined;
  return {
    label: 'Open System Settings',
    onClick: () => {
      window.electron?.ipcRenderer
        ?.invoke('open-screen-recording-settings', undefined)
        .catch(() => {});
    },
  };
}

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
    <div className={cx('app-container', styles.editorWindow)}>
      <TitleBar
        title={screenshot ? 'Screenshot' : 'X-Shot'}
        detail={
          screenshot ? `${screenshot.width} × ${screenshot.height}` : undefined
        }
      />
      <main className={styles.main}>
        {notice && (
          <Toast
            key={notice.id}
            className={styles.toast}
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
            className={styles.toast}
            tone="error"
            message={failure.message}
            onDismiss={dismissFailure}
            action={failureAction(failure)}
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
          <EmptyState />
        )}
      </main>
    </div>
  );
}

function Shell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  // The editor draws its own title bar, which shows the capture's size.
  if (pathname === '/') return children;
  return (
    <div className="app-container">
      {pathname === '/preferences' && (
        <TitleBar title="Preferences" logo={false} />
      )}
      <div className={styles.routeContent}>{children}</div>
    </div>
  );
}

export default function App() {
  return (
    <LucideProvider strokeWidth={1.75}>
      <Router>
        <Shell>
          <Routes>
            <Route path="/" element={<Hello />} />
            <Route path="/screenshot" element={<ScreenshotCapture />} />
            <Route path="/preferences" element={<PreferencesWindow />} />
          </Routes>
        </Shell>
      </Router>
    </LucideProvider>
  );
}

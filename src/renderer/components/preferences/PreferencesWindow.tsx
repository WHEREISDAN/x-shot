import { useState, type ReactNode } from 'react';
import { Lock, Pen, RotateCcw, SlidersVertical, Upload } from 'lucide-react';
import usePreferences from '../../hooks/use-preferences';
import { Toast } from '../../design-system';
import cx from '../../design-system/class-names';
import GeneralSection from './GeneralSection';
import EditorSection from './EditorSection';
import ExportSection from './ExportSection';
import PrivacySection from './PrivacySection';
import ResetDialog from './ResetDialog';
import styles from './PreferencesWindow.module.css';

type TabId = 'general' | 'editor' | 'export' | 'privacy';

interface Tab {
  id: TabId;
  label: string;
  icon: ReactNode;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General', icon: <SlidersVertical /> },
  { id: 'editor', label: 'Editor', icon: <Pen /> },
  { id: 'export', label: 'Export', icon: <Upload /> },
  { id: 'privacy', label: 'Privacy', icon: <Lock /> },
];

export default function PreferencesWindow() {
  const {
    preferences,
    loading,
    error,
    updatePreferences,
    flushPreferences,
    resetPreferences,
    dismissError,
  } = usePreferences();
  const [activeTab, setActiveTab] = useState<TabId>('general');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Only before the first load; saves never swap the window's content.
  if (loading || !preferences) {
    return (
      <div className={cx(styles.window, styles.message)}>
        {loading ? 'Loading preferences...' : 'Failed to load preferences'}
      </div>
    );
  }

  const renderActiveSection = () => {
    switch (activeTab) {
      case 'general':
        return (
          <GeneralSection
            preferences={preferences}
            onUpdate={updatePreferences}
          />
        );
      case 'editor':
        return (
          <EditorSection
            preferences={preferences}
            onUpdate={updatePreferences}
            onFlush={flushPreferences}
          />
        );
      case 'export':
        return (
          <ExportSection
            preferences={preferences}
            onUpdate={updatePreferences}
            onFlush={flushPreferences}
          />
        );
      case 'privacy':
        return (
          <PrivacySection
            preferences={preferences}
            onUpdate={updatePreferences}
          />
        );
      default:
        return null;
    }
  };

  const activeLabel =
    TABS.find((tab) => tab.id === activeTab)?.label ?? 'Preferences';

  return (
    <div className={styles.window}>
      {error && (
        <Toast
          tone="error"
          message={error}
          onDismiss={dismissError}
          className={styles.toast}
        />
      )}

      <nav className={styles.nav}>
        <div
          role="tablist"
          aria-label="Preferences Sections"
          aria-orientation="vertical"
          className={styles.tabs}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              className={cx(styles.tab, activeTab === tab.id && styles.active)}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className={cx(styles.tab, styles.reset)}
          onClick={() => setShowResetConfirm(true)}
        >
          <RotateCcw />
          Reset to defaults
        </button>
      </nav>

      <div
        className={styles.pane}
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
      >
        <h1 className={styles.title}>{activeLabel}</h1>
        {renderActiveSection()}
      </div>

      {showResetConfirm && (
        <ResetDialog
          onCancel={() => setShowResetConfirm(false)}
          onConfirm={async () => {
            await resetPreferences();
            setShowResetConfirm(false);
          }}
        />
      )}
    </div>
  );
}

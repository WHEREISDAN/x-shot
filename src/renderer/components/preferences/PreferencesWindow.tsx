import React, { useState } from 'react';
import usePreferences from '../../hooks/use-preferences';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../design-system/tokens';
import GeneralSection from './GeneralSection';
import EditorSection from './EditorSection';
import ExportSection from './ExportSection';
import PrivacySection from './PrivacySection';

type TabId = 'general' | 'editor' | 'export' | 'privacy';

interface Tab {
  id: TabId;
  label: string;
  icon: string;
}

const tabs: Tab[] = [
  { id: 'general', label: 'General', icon: '⚙️' },
  { id: 'editor', label: 'Editor', icon: '✏️' },
  { id: 'export', label: 'Export', icon: '📤' },
  { id: 'privacy', label: 'Privacy', icon: '🔒' },
];

export default function PreferencesWindow() {
  const { preferences, loading, error, updatePreferences, resetPreferences } =
    usePreferences();
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const containerStyles: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    maxHeight: '95vh',
    background: colors.background.primary,
    color: colors.text.primary,
    fontFamily: typography.fontFamily.system,
    overflow: 'hidden',
  };

  const contentStyles: React.CSSProperties = {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  };

  const sidebarStyles: React.CSSProperties = {
    width: '200px',
    minWidth: '200px',
    flexShrink: 0,
    background: colors.background.secondary,
    borderRight: `1px solid ${colors.border.default}`,
    padding: spacing[4],
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[2],
    overflowY: 'auto',
  };

  const tabStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[3]}`,
    borderRadius: borderRadius.md,
    cursor: 'pointer',
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    transition: 'all 150ms ease',
    border: 'none',
    background: 'transparent',
    color: colors.text.secondary,
    textAlign: 'left',
  };

  const activeTabStyles: React.CSSProperties = {
    ...tabStyles,
    background: colors.surface.active,
    color: colors.text.primary,
  };

  const mainStyles: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden', // Prevent this container from growing beyond available space
  };

  const mainContentStyles: React.CSSProperties = {
    position: 'relative',
    height: 0,
    flex: 1,
    padding: spacing[6],
    paddingTop: 0,
    overflow: 'auto',
  };

  const headerStyles: React.CSSProperties = {
    position: 'sticky',
    width: '100%',
    top: 0,
    zIndex: 1,
    paddingBottom: spacing[3],
    paddingTop: spacing[4],
    marginBottom: spacing[4],
    background: colors.background.primary,
    borderBottom: `1px solid ${colors.border.default}`,
  };

  const titleStyles: React.CSSProperties = {
    fontSize: typography.fontSize['2xl'],
    fontWeight: typography.fontWeight.bold,
    marginBottom: spacing[2],
  };

  const subtitleStyles: React.CSSProperties = {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
  };

  const loadingStyles: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    fontSize: typography.fontSize.lg,
    color: colors.text.secondary,
  };

  const errorStyles: React.CSSProperties = {
    padding: spacing[4],
    background: colors.error,
    color: colors.white,
    borderRadius: borderRadius.md,
    marginBottom: spacing[4],
  };

  const footerStyles: React.CSSProperties = {
    padding: spacing[4],
    borderTop: `1px solid ${colors.border.default}`,
    display: 'flex',
    justifyContent: 'flex-end',
    gap: spacing[3],
    backgroundColor: colors.background.primary,
    flexShrink: 0,
  };

  const buttonStyles: React.CSSProperties = {
    padding: `${spacing[2]} ${spacing[4]}`,
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.border.emphasis}`,
    background: colors.surface.default,
    color: colors.text.primary,
    fontSize: typography.fontSize.sm,
    fontWeight: typography.fontWeight.medium,
    cursor: 'pointer',
    transition: 'all 150ms ease',
  };

  const resetButtonStyles: React.CSSProperties = {
    ...buttonStyles,
    background: colors.error,
    borderColor: colors.error,
    color: colors.white,
  };

  if (loading) {
    return (
      <div style={containerStyles}>
        <div style={loadingStyles}>Loading preferences...</div>
      </div>
    );
  }

  if (!preferences) {
    return (
      <div style={containerStyles}>
        <div style={loadingStyles}>Failed to load preferences</div>
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
          />
        );
      case 'export':
        return (
          <ExportSection
            preferences={preferences}
            onUpdate={updatePreferences}
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

  const getTabTitle = () => {
    const tab = tabs.find((t) => t.id === activeTab);
    return tab ? tab.label : 'Preferences';
  };

  const handleReset = async () => {
    // eslint-disable-next-line no-alert
    if (
      window.confirm(
        'Are you sure you want to reset all preferences to defaults? This cannot be undone.',
      )
    ) {
      await resetPreferences();
    }
  };

  return (
    <div style={containerStyles}>
      {error && <div style={errorStyles}>Error: {error}</div>}

      <div style={contentStyles}>
        {/* Sidebar */}
        <div
          style={sidebarStyles}
          role="tablist"
          aria-label="Preferences Sections"
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`panel-${tab.id}`}
              style={activeTab === tab.id ? activeTabStyles : tabStyles}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = colors.surface.hover;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <span aria-hidden>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Main content */}
        <div style={mainStyles}>
          <div
            style={mainContentStyles}
            id={`panel-${activeTab}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeTab}`}
          >
            <div style={headerStyles}>
              <h1 style={titleStyles}>{getTabTitle()}</h1>
              <p style={subtitleStyles}>Customize X-Shot to your preferences</p>
            </div>

            {renderActiveSection()}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div style={footerStyles}>
        <button
          type="button"
          style={resetButtonStyles}
          onClick={handleReset}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#dc2626';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = colors.error;
          }}
        >
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}

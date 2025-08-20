/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/no-noninteractive-tabindex */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSelection } from './hooks/use-selection';
import DimOverlays from './components/DimOverlays';
import SelectionOverlay from './components/SelectionOverlay';
import QuickDock from './components/QuickDock';
import SourcesPanel from './components/SourcesPanel';
import type { ScreenSourceItem, WindowSourceItem } from '../shared/ipc-types';
import { createRendererLogger } from './utils/logger';

const logger = createRendererLogger('screenshot-capture');

function ScreenshotCapture() {
  const { offsetX, offsetY, isPrimary } = useMemo(() => {
    const { hash } = window.location;
    const queryIndex = hash.indexOf('?');
    const params = new URLSearchParams(
      queryIndex >= 0 ? hash.substring(queryIndex + 1) : '',
    );
    const x = Number(params.get('offsetX') || '0');
    const y = Number(params.get('offsetY') || '0');
    const primary = params.get('primary') === '1';
    return {
      offsetX: Number.isFinite(x) ? x : 0,
      offsetY: Number.isFinite(y) ? y : 0,
      isPrimary: primary,
    };
  }, []);

  const selection = useSelection({ offsetX, offsetY });
  const { clear: clearSelection } = selection;

  const [isPrimaryDisplay] = useState<boolean>(isPrimary);
  const [showWindowsPanel, setShowWindowsPanel] = useState(false);
  const [showDisplaysPanel, setShowDisplaysPanel] = useState(false);
  const [windowSources, setWindowSources] = useState<WindowSourceItem[]>([]);
  const [screenSources, setScreenSources] = useState<ScreenSourceItem[]>([]);
  const [background, setBackground] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const { hash } = window.location;
    const queryIndex = hash.indexOf('?');
    const params = new URLSearchParams(
      queryIndex >= 0 ? hash.substring(queryIndex + 1) : '',
    );
    const displayIdParam = params.get('displayId');
    const displayId = displayIdParam ? Number(displayIdParam) : undefined;
    const run = async () => {
      try {
        if (displayId === undefined || Number.isNaN(displayId)) return;
        const res = await window.electron.ipcRenderer.invoke(
          'get-display-snapshot',
          { displayId },
        );
        if (!cancelled && res) {
          setBackground({
            url: res.dataUrl,
            width: res.width,
            height: res.height,
          });
        }
      } catch (error) {
        logger.warn('Failed to get display snapshot', error);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleWindowsPanel = useCallback(async () => {
    const next = !showWindowsPanel;
    setShowWindowsPanel(next);
    setShowDisplaysPanel(false);
    // Clear any existing area selection when switching to windows panel
    if (next) clearSelection();
    if (next && windowSources.length === 0) {
      try {
        const sources = await window.electron.ipcRenderer.invoke(
          'list-capture-sources',
          { type: 'window' },
        );
        if (Array.isArray(sources))
          setWindowSources(sources as WindowSourceItem[]);
      } catch (error) {
        logger.warn('Failed to load window sources', error);
        setWindowSources([]);
      }
    }
  }, [showWindowsPanel, windowSources.length, clearSelection]);

  const toggleDisplaysPanel = useCallback(async () => {
    const next = !showDisplaysPanel;
    setShowDisplaysPanel(next);
    setShowWindowsPanel(false);
    // Clear any existing area selection when switching to displays panel
    if (next) clearSelection();
    if (next && screenSources.length === 0) {
      try {
        const sources = await window.electron.ipcRenderer.invoke(
          'list-capture-sources',
          { type: 'screen' },
        );
        if (Array.isArray(sources))
          setScreenSources(sources as ScreenSourceItem[]);
      } catch (error) {
        logger.warn('Failed to load screen sources', error);
        setScreenSources([]);
      }
    }
  }, [showDisplaysPanel, screenSources.length, clearSelection]);

  const captureWindow = useCallback(
    (sourceId: string) => {
      // Clear selection before initiating window capture
      clearSelection();
      try {
        window.electron.ipcRenderer.sendMessage('screenshot-window', {
          sourceId,
        });
      } catch {
        // noop
      }
    },
    [clearSelection],
  );

  const captureScreen = useCallback(
    (sourceId: string) => {
      // Clear selection before initiating display capture
      clearSelection();
      try {
        window.electron.ipcRenderer.sendMessage('screenshot-screen', {
          sourceId,
        });
      } catch {
        // noop
      }
    },
    [clearSelection],
  );

  return (
    <div
      style={{
        margin: 0,
        padding: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        background: 'transparent',
        fontFamily: 'Arial, sans-serif',
        position: 'fixed',
        top: 0,
        left: 0,
        cursor: 'crosshair',
      }}
      onMouseDown={(e) => {
        // Ignore clicks originating from selection elements or dock
        const target = e.target as HTMLElement;
        if (
          target.closest(
            '[data-selection-root="1"],[data-quick-dock="1"],[data-capture-button="1"],[data-sources-panel="1"]',
          )
        ) {
          e.stopPropagation();
          return;
        }

        // If a sources panel is open and user clicks outside it, close panels
        if (showWindowsPanel || showDisplaysPanel) {
          setShowWindowsPanel(false);
          setShowDisplaysPanel(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        // Explicitly capture pointer to this container so move/up events are not lost
        // Best-effort pointer capture; ignore if unsupported
        try {
          const maybePointerEvent = e.nativeEvent as unknown as {
            pointerId?: number;
          };
          const capturer = e.currentTarget as unknown as {
            setPointerCapture?: (id: number) => void;
          };
          if (maybePointerEvent.pointerId !== undefined) {
            capturer.setPointerCapture?.(maybePointerEvent.pointerId);
          }
        } catch {
          // noop
        }
        selection.onMouseDown(e);
      }}
      onMouseMove={(e) => {
        setPointer({ x: e.clientX, y: e.clientY });
        selection.onMouseMove(e);
      }}
      onMouseUp={selection.onMouseUp}
      onKeyDown={selection.onKeyDown}
      role="application"
      tabIndex={0}
    >
      {background && (
        <img
          src={background.url}
          alt="Display snapshot"
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            objectFit: 'fill',
            zIndex: 0,
            pointerEvents: 'none',
          }}
        />
      )}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'transparent',
          cursor: 'crosshair',
          zIndex: 1000,
          willChange: 'opacity',
          transform: 'translateZ(0)',
          pointerEvents: 'none',
        }}
      />

      <DimOverlays
        top={selection.overlayRects.top}
        left={selection.overlayRects.left}
        right={selection.overlayRects.right}
        bottom={selection.overlayRects.bottom}
      />

      <SelectionOverlay selection={selection.selection} />

      {/* Magnifier */}
      {background && pointer && (
        <div
          style={{
            position: 'fixed',
            left: Math.min(pointer.x + 24, window.innerWidth - 140),
            top: Math.min(pointer.y + 24, window.innerHeight - 140),
            width: 120,
            height: 120,
            borderRadius: 80,
            overflow: 'hidden',
            zIndex: 1004,
            pointerEvents: 'none',
            boxShadow: '0 6px 16px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.15)',
            backgroundImage: `url(${background.url})`,
            backgroundRepeat: 'no-repeat',
            // Scale up display snapshot; since snapshot is stretched to viewport, use viewport coords
            backgroundSize: `${window.innerWidth * 3}px ${window.innerHeight * 3}px`,
            backgroundPosition: `-${pointer.x * 3 - 60}px -${pointer.y * 3 - 60}px`,
          }}
          aria-hidden="true"
        >
          {/* Pixel grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(90deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 3px), repeating-linear-gradient(0deg, rgba(255,255,255,0.15) 0, rgba(255,255,255,0.15) 1px, transparent 1px, transparent 3px)',
              backgroundSize: '3px 3px, 3px 3px',
              mixBlendMode: 'overlay',
            }}
          />
          {/* Crosshair */}
          <div
            style={{
              position: 'absolute',
              left: 60,
              top: 0,
              width: 1,
              height: '100%',
              background: 'rgba(255,255,255,0.8)',
              opacity: 0.7,
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: 60,
              left: 0,
              height: 1,
              width: '100%',
              background: 'rgba(255,255,255,0.8)',
              opacity: 0.7,
            }}
          />
        </div>
      )}

      <button
        type="button"
        onClick={selection.confirm}
        style={{
          position: 'absolute',
          appearance: 'none',
          background: 'rgba(255,255,255,0.08)',
          color: 'white',
          border: '1px solid rgba(255,255,255,0.2)',
          padding: '10px 14px',
          borderRadius: 12,
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: 0.2,
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.25)',
          whiteSpace: 'nowrap',
          zIndex: 1003,
          display: selection.selection ? 'block' : 'none',
          left: selection.selection
            ? Math.min(
                selection.selection.x + selection.selection.width,
                window.innerWidth - 12,
              )
            : 0,
          top: selection.selection
            ? Math.min(
                selection.selection.y + selection.selection.height + 12,
                window.innerHeight - 56,
              )
            : 0,
          transform: 'translateX(-100%)',
        }}
        data-capture-button="1"
      >
        ✓ Capture
      </button>

      {isPrimaryDisplay && (
        <QuickDock
          onToggleWindows={toggleWindowsPanel}
          onToggleDisplays={toggleDisplaysPanel}
          onCancel={() => {
            try {
              window.electron.ipcRenderer.sendMessage(
                'screenshot-cancel',
                undefined,
              );
            } catch {
              // noop
            }
            window.close();
          }}
        />
      )}

      {showWindowsPanel && (
        <SourcesPanel
          title="Windows"
          sources={windowSources}
          onSelect={captureWindow}
        />
      )}

      {showDisplaysPanel && (
        <SourcesPanel
          title="Displays"
          sources={screenSources}
          onSelect={captureScreen}
        />
      )}
    </div>
  );
}

export default ScreenshotCapture;

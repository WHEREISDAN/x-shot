/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus, jsx-a11y/no-noninteractive-tabindex */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useSelection } from './hooks/use-selection';
import DimOverlays from './components/DimOverlays';
import SelectionOverlay from './components/SelectionOverlay';
import QuickDock from './components/QuickDock';
import SourcesPanel from './components/SourcesPanel';
import Magnifier from './components/Magnifier';
import CaptureHint from './components/CaptureHint';
import capturePixelSize from './components/capture-pixel-size';
import { Button } from './design-system';
import styles from './ScreenshotCapture.module.css';
import type { ScreenSourceItem, WindowSourceItem } from '../shared/ipc-types';
import { captureAssetUrl } from '../shared/capture-asset';
import { createRendererLogger } from './utils/logger';

const logger = createRendererLogger('screenshot-capture');

/** Controls that take the pointer; the magnifier hides over them. */
const CONTROLS =
  '[data-quick-dock="1"],[data-capture-button="1"],[data-sources-panel="1"]';

function ScreenshotCapture() {
  const { offsetX, offsetY, displayId } = useMemo(() => {
    const { hash } = window.location;
    const queryIndex = hash.indexOf('?');
    const params = new URLSearchParams(
      queryIndex >= 0 ? hash.substring(queryIndex + 1) : '',
    );
    const x = Number(params.get('offsetX') || '0');
    const y = Number(params.get('offsetY') || '0');
    const id = Number(params.get('displayId'));
    return {
      offsetX: Number.isFinite(x) ? x : 0,
      offsetY: Number.isFinite(y) ? y : 0,
      displayId:
        params.get('displayId') && Number.isFinite(id) ? id : undefined,
    };
  }, []);

  const selection = useSelection({ offsetX, offsetY, displayId });
  const { clear: clearSelection } = selection;

  // Main closes the overlays on every display.
  const cancelCapture = useCallback(() => {
    try {
      window.electron.ipcRenderer.sendMessage('screenshot-cancel', undefined);
    } catch (error) {
      logger.warn('Failed to cancel the capture', error);
    }
  }, []);

  // Escape works wherever focus is, not only on a focused element.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      cancelCapture();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cancelCapture]);
  const [showWindowsPanel, setShowWindowsPanel] = useState(false);
  const [showDisplaysPanel, setShowDisplaysPanel] = useState(false);
  const [windowSources, setWindowSources] = useState<WindowSourceItem[]>([]);
  const [screenSources, setScreenSources] = useState<ScreenSourceItem[]>([]);
  const [background, setBackground] = useState<{
    url: string;
    width: number;
    height: number;
  } | null>(null);
  const [pointer, setPointer] = useState<{
    x: number;
    y: number;
    overControls: boolean;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (displayId === undefined) return;
        const res = await window.electron.ipcRenderer.invoke(
          'get-display-snapshot',
          { displayId },
        );
        if (!cancelled && res) {
          setBackground({
            url: captureAssetUrl(res.assetId),
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
  }, [displayId]);

  const toggleWindowsPanel = useCallback(async () => {
    const next = !showWindowsPanel;
    setShowWindowsPanel(next);
    setShowDisplaysPanel(false);
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
      clearSelection();
      const source = screenSources.find((s) => s.id === sourceId);
      try {
        window.electron.ipcRenderer.sendMessage('screenshot-screen', {
          sourceId,
          displayId: source?.displayId ?? undefined,
        });
      } catch {
        // noop
      }
    },
    [clearSelection, screenSources],
  );

  const pixelSize = useMemo(
    () =>
      selection.selection &&
      capturePixelSize(
        selection.selection,
        { width: window.innerWidth, height: window.innerHeight },
        background,
        window.devicePixelRatio || 1,
      ),
    [selection.selection, background],
  );
  const panelOpen = showWindowsPanel || showDisplaysPanel;

  return (
    <div
      className={styles.overlay}
      onMouseDown={(e) => {
        const target = e.target as HTMLElement;
        if (target.closest(`[data-selection-root="1"],${CONTROLS}`)) {
          e.stopPropagation();
          return;
        }

        // If a sources panel is open and user clicks outside it, close panels
        if (panelOpen) {
          setShowWindowsPanel(false);
          setShowDisplaysPanel(false);
          e.preventDefault();
          e.stopPropagation();
          return;
        }
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
      // Capture phase: the dock stops mouse moves from bubbling up here.
      onMouseMoveCapture={(e) =>
        setPointer({
          x: e.clientX,
          y: e.clientY,
          overControls: !!(e.target as HTMLElement).closest(CONTROLS),
        })
      }
      onMouseMove={selection.onMouseMove}
      onMouseUp={selection.onMouseUp}
      role="application"
      tabIndex={0}
    >
      {background && (
        <img
          src={background.url}
          alt="Display snapshot"
          className={styles.snapshot}
        />
      )}
      <div className={styles.compositorLayer} />

      <DimOverlays
        top={selection.overlayRects.top}
        left={selection.overlayRects.left}
        right={selection.overlayRects.right}
        bottom={selection.overlayRects.bottom}
      />

      <SelectionOverlay selection={selection.selection} pixelSize={pixelSize} />

      {background && pointer && !pointer.overControls && !panelOpen && (
        <Magnifier src={background.url} pointer={pointer} />
      )}

      {selection.selection && (
        <div
          className={styles.captureButton}
          style={{
            left: Math.min(
              selection.selection.x + selection.selection.width,
              window.innerWidth - 12,
            ),
            top: Math.min(
              selection.selection.y + selection.selection.height + 12,
              window.innerHeight - 56,
            ),
          }}
          data-capture-button="1"
        >
          <Button
            variant="primary"
            icon={<span className={styles.spark} />}
            onClick={selection.confirm}
          >
            Capture
          </Button>
        </div>
      )}

      {!selection.selection && !panelOpen && <CaptureHint />}

      <QuickDock
        onToggleWindows={toggleWindowsPanel}
        onToggleDisplays={toggleDisplaysPanel}
        onCancel={cancelCapture}
        windowsOpen={showWindowsPanel}
        displaysOpen={showDisplaysPanel}
      />

      {showWindowsPanel && (
        <SourcesPanel
          title="Windows"
          count={`${windowSources.length} open`}
          sources={windowSources}
          onSelect={captureWindow}
        />
      )}

      {showDisplaysPanel && (
        <SourcesPanel
          title="Displays"
          count={`${screenSources.length} connected`}
          sources={screenSources}
          onSelect={captureScreen}
        />
      )}
    </div>
  );
}

export default ScreenshotCapture;

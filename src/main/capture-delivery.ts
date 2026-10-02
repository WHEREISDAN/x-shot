import { desktopCapturer, screen } from 'electron';
import type { BrowserWindow, NativeImage } from 'electron';
import type { CaptureResult, ScreenshotResult } from '../shared/ipc-types';
import type { CaptureAssetRef } from '../shared/capture-asset';
import { captureAssets } from './capture-assets';
import { CaptureError, toCaptureSuccess } from './capture-result';
import {
  closeScreenshotOverlays,
  ensureMainWindowReady,
  hideWindowsForCapture,
} from './windows';
import { updatePreferences } from './preferences';
import measureWindowSource, { windowThumbnailSize } from './window-source-size';
import {
  computeCropRect,
  displayForSelection,
  physicalSize,
} from '../shared/crop-geometry';
import { markCaptureStage } from './capture-diagnostics';
import {
  getDisplaySnapshot,
  pickSourceForDisplay,
  releaseDisplaySnapshots,
  type DisplaySnapshot,
} from './display-snapshots';
import {
  isSessionCurrent,
  type CaptureRect,
  type CaptureSessionRef,
} from './capture-coordinator';

// Delivers a confirmed capture to the editor: acquires the pixels, keeps
// them in main's asset store and sends the editor their id and size.

/** Pixels a selection is cropped from: a frozen snapshot or a live capture. */
type CropSource = Omit<DisplaySnapshot, 'assetId'>;

/** Keeps the capture in main; the editor gets only its id and size. */
const storeCapture = (
  session: CaptureSessionRef,
  image: NativeImage,
  scaleFactor: number,
): CaptureAssetRef => {
  if (image.isEmpty()) throw new Error('The captured image is empty.');
  const { width, height } = image.getSize();
  const png = image.toPNG();
  const asset = captureAssets.add({
    sessionId: session.id,
    kind: 'capture',
    width,
    height,
    scaleFactor,
    encode: () => png,
  });
  return { assetId: asset.assetId, width, height, scaleFactor };
};

// The editor shows one capture at a time, so a delivered capture releases
// the one it replaces.
const sendCaptureResult = (
  win: BrowserWindow,
  session: CaptureSessionRef,
  result: CaptureResult,
) => {
  win.webContents.send('capture-result', result);
  captureAssets.releaseWhere((asset) => asset.sessionId !== session.id);
};

const scaleFactorOf = (displayId: string | number | undefined) =>
  (
    screen.getAllDisplays().find((d) => String(d.id) === String(displayId)) ??
    screen.getPrimaryDisplay()
  ).scaleFactor;

export const deliverWindowCapture = async (
  session: CaptureSessionRef,
  sourceId: string,
) => {
  await closeScreenshotOverlays();
  releaseDisplaySnapshots();
  await hideWindowsForCapture();
  if (!isSessionCurrent(session)) return;

  // Thumbnails are scaled to fill the requested box, so the window is
  // requested at its measured native size.
  const editor = await ensureMainWindowReady();
  const measureStart = Date.now();
  const nativeSize = await measureWindowSource(editor.webContents, sourceId);
  if (!isSessionCurrent(session)) return;
  markCaptureStage('window-measured', {
    sourceId,
    nativeSize,
    durationMs: Date.now() - measureStart,
  });
  const sources = await desktopCapturer.getSources({
    types: ['window'],
    thumbnailSize: windowThumbnailSize(nativeSize),
  });
  const source = sources.find((s) => s.id === sourceId);
  if (!source) {
    throw new CaptureError('source-unavailable', 'Window source not found');
  }
  const { thumbnail, name } = source;
  // desktopCapturer does not report a window's display, so the primary
  // display's scale is the best estimate.
  const asset = storeCapture(
    session,
    thumbnail,
    screen.getPrimaryDisplay().scaleFactor,
  );
  const result = toCaptureSuccess({
    ...asset,
    sourceId: source.id,
    windowTitle: name,
    isWindowCapture: true,
    sessionId: session.id,
  } satisfies ScreenshotResult);
  const win = await ensureMainWindowReady();
  markCaptureStage('editor-sent', {
    captureKind: 'window',
    sourceId: source.id,
    outputWidth: asset.width,
    outputHeight: asset.height,
  });
  sendCaptureResult(win, session, result);
};

export const deliverScreenCapture = async (
  session: CaptureSessionRef,
  request: { sourceId?: string; displayId?: number | string },
) => {
  await closeScreenshotOverlays();
  releaseDisplaySnapshots();
  await hideWindowsForCapture();
  if (!isSessionCurrent(session)) return;

  // Request the chosen display at its native size; without a known display
  // use the largest one so no screen is downscaled.
  const displays = screen.getAllDisplays();
  const chosen = displays.find(
    (d) => String(d.id) === String(request.displayId),
  );
  const sizes = (chosen ? [chosen] : displays).map(physicalSize);
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.max(...sizes.map((size) => size.width)),
      height: Math.max(...sizes.map((size) => size.height)),
    },
  });
  const source =
    sources.find((s) => s.id === request.sourceId) ??
    sources.find((s) => s.display_id === String(request.displayId)) ??
    sources[0];
  if (!source) {
    throw new CaptureError('source-unavailable', 'Screen source not found');
  }

  const asset = storeCapture(
    session,
    source.thumbnail,
    scaleFactorOf(source.display_id || request.displayId),
  );
  const result = toCaptureSuccess({
    ...asset,
    sourceId: source.id,
    displayId: source.display_id || null,
    isDisplayCapture: true,
    sessionId: session.id,
  } satisfies ScreenshotResult);
  const win = await ensureMainWindowReady();
  markCaptureStage('editor-sent', {
    captureKind: 'screen',
    sourceId: source.id,
    outputWidth: asset.width,
    outputHeight: asset.height,
  });
  sendCaptureResult(win, session, result);
};

export const deliverSelectionCapture = async (
  session: CaptureSessionRef,
  data: CaptureRect,
) => {
  markCaptureStage('selection-confirmed');
  // Overlays must be gone before any post-selection acquisition so they
  // can never appear in the resulting pixels.
  await closeScreenshotOverlays();
  if (!isSessionCurrent(session)) return;

  // Capture from the display the selection was drawn on.
  const targetDisplay = displayForSelection(screen.getAllDisplays(), data);
  if (!targetDisplay) {
    throw new CaptureError('source-unavailable', 'No display found');
  }
  const { bounds, scaleFactor, id } = targetDisplay;
  // Refuse an empty area before touching any pixels.
  const displayGeometry = { ...physicalSize(targetDisplay), bounds };
  if (!computeCropRect(data, displayGeometry)) {
    throw new CaptureError('empty-selection', 'Empty selection');
  }

  // The frozen snapshot the user selected on; re-capture has none and
  // acquires the display live, once X-Shot's windows are hidden.
  let snapshot: CropSource | undefined = getDisplaySnapshot(id);
  if (!snapshot) {
    await hideWindowsForCapture();
    if (!isSessionCurrent(session)) return;
    const liveSources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: physicalSize(targetDisplay),
    });
    const match = pickSourceForDisplay(liveSources, targetDisplay);
    if (!match) {
      throw new CaptureError('source-unavailable', 'No screen source found');
    }
    const img = match.thumbnail;
    snapshot = {
      image: img,
      width: img.getSize().width,
      height: img.getSize().height,
      bounds,
      scaleFactor: scaleFactor || 1,
      sourceId: match.id,
    };
  }

  const cropRect = computeCropRect(data, snapshot);
  if (!cropRect) throw new CaptureError('empty-selection', 'Empty selection');
  const asset = storeCapture(
    session,
    snapshot.image.crop(cropRect),
    snapshot.scaleFactor,
  );
  const result = toCaptureSuccess({
    ...asset,
    x: data.x,
    y: data.y,
    sourceId: String(id),
    displayId: id,
    sessionId: session.id,
  } satisfies ScreenshotResult);
  const win = await ensureMainWindowReady();

  // Persist last selection for quick re-capture
  try {
    await updatePreferences({
      capture: {
        lastSelection: {
          x: data.x,
          y: data.y,
          width: data.width,
          height: data.height,
          displayId: id,
        },
      } as any,
    });
  } catch {
    // noop
  }

  markCaptureStage('editor-sent', {
    captureKind: 'selection',
    displayId: id,
    displayBounds: bounds,
    scaleFactor,
    sourceId: snapshot.sourceId,
    frameWidth: snapshot.width,
    frameHeight: snapshot.height,
    cropRect,
    outputWidth: asset.width,
    outputHeight: asset.height,
  });
  sendCaptureResult(win, session, result);
  releaseDisplaySnapshots();
};

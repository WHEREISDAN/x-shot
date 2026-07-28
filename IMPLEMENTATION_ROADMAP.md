# X-Shot Implementation Roadmap

This roadmap turns the architecture review into an implementation sequence. The
order is intentional: correctness and observability come first, followed by the
image transport and capture foundations, then performance, editor/export work,
and finally broader hardening.

The target capture flow is:

```text
Trigger
  -> CaptureSession coordinator
  -> native-resolution display/window frame
  -> in-memory capture asset
  -> lightweight per-display overlay preview
  -> crop/commit by capture ID
  -> editor scene
  -> deterministic encoded export
```

## Guiding Constraints

- Preserve the frozen-screen selection experience.
- Never capture an X-Shot overlay or editor window unintentionally.
- Treat display coordinates as device-independent pixels (DIP) and image
  coordinates as physical pixels. Convert only at explicit boundaries.
- Avoid base64/data URLs for internal image transport.
- Keep one overlay window per display; this handles mixed scale factors and
  negative display coordinates more safely than one virtual-desktop window.
- Every capture trigger must produce at most one result.
- Do not begin the next phase until the previous phase's completion conditions
  pass.

## Phase 0 — Baseline, Fixtures, and Instrumentation

### Goal

Create a measurable baseline and test fixtures before changing the pipeline.
This makes regressions in resolution, coordinates, latency, and memory visible.

### Work

1. Add a capture diagnostics logger with a generated `sessionId`.
2. Record timings for:
   - trigger to snapshot ready;
   - snapshot ready to overlays visible;
   - selection confirmation to editor ready;
   - editor export duration.
3. Record capture metadata without image contents:
   - platform;
   - display ID;
   - display bounds;
   - scale factor;
   - source ID;
   - source frame size;
   - crop rectangle;
   - output size.
4. Add deterministic test fixtures for:
   - one 1920×1080 display at 1×;
   - one Retina/HiDPI display at 2×;
   - two displays with different scale factors;
   - a secondary display positioned left of the primary display;
   - a secondary display positioned above the primary display;
   - a 5K display;
   - a rotated portrait display.
5. Add unit tests for DIP-to-image crop conversion.
6. Fix the Jest haste-map warning by excluding `release/app` from module
   discovery.
7. Add a CI command that runs TypeScript, lint, tests, and the production build.

### Likely Files

- `src/main/ipc/screenshot.ts`
- `src/main/logger.ts`
- `src/shared/ipc-types.ts`
- `src/__tests__/`
- `package.json`

### Completion and Test Conditions

- [ ] `npm test -- --runInBand` passes without the haste-map collision warning.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npm run lint` has no errors; existing warnings are documented or fixed.
- [ ] `npm run build` passes.
- [ ] Coordinate conversion tests cover all fixtures listed above.
- [ ] A manual capture log contains one traceable `sessionId` from trigger
      through editor delivery.
- [ ] Logs contain dimensions and timings but never screenshot bytes, data URLs,
      OCR text, or detected PII.

## Phase 1 — Capture Session Coordinator and Lifecycle Correctness

### Goal

Eliminate overlapping capture operations, non-awaited overlay teardown,
duplicate results, and recapture behavior that can include X-Shot itself.

### Work

1. Introduce a main-process `CaptureSession` coordinator with explicit states:

   ```text
   idle -> preparing -> selecting -> committing -> idle
                              \-> canceling -> idle
   ```

2. Assign every session a unique ID and generation token.
3. Ignore or cancel stale asynchronous work when its generation no longer
   matches the active session.
4. Make `closeScreenshotOverlays()` return `Promise<void>`.
5. Await overlay hiding/closing before any capture that occurs after selection.
6. Make confirm and cancel idempotent.
7. Disable or ignore repeated capture triggers while a transition is already in
   progress. Define the chosen behavior in code and UI:
   - recommended: a second trigger cancels the current selection and starts a
     new session only after cleanup finishes.
8. Route tray capture, hotkey capture, delayed capture, and recapture through
   the same coordinator API instead of emitting IPC events internally.
9. Fix recapture so the main window is hidden before acquisition and the
   compositor has acknowledged the hidden state.
10. Handle display removal, display addition, app quit, and renderer crash by
    canceling the active session and releasing its assets.

### Likely Files

- `src/main/main.ts`
- `src/main/windows.ts`
- `src/main/ipc/screenshot.ts`
- `src/main/tray.ts`
- `src/main/hotkeys.ts`

### Completion and Test Conditions

- [ ] Unit tests verify every legal state transition.
- [ ] Unit tests reject commit/cancel calls with a stale or unknown `sessionId`.
- [ ] Two confirmations from the same session deliver exactly one screenshot.
- [ ] Pressing the capture hotkey rapidly 10 times never creates more than one
      active session or one overlay per display.
- [ ] Cancel during snapshot preparation leaves no overlay windows or snapshot
      assets alive.
- [ ] Cancel from Escape, the dock, and app shutdown reaches `idle`.
- [ ] Recapture never includes the editor or overlay in the resulting pixels.
- [ ] Removing a monitor during selection cancels cleanly without an unhandled
      rejection.
- [ ] Delayed capture can be canceled before its timer fires.

## Phase 2 — In-Memory Capture Assets and Binary Transport

### Goal

Remove full-resolution data URLs from IPC and keep each frame in memory only
once wherever practical.

### Work

1. Add an in-memory `CaptureAssetStore` owned by the active capture session.
2. Address assets by opaque IDs rather than passing image contents:
   - `sessionId`;
   - `assetId`;
   - `displayId`;
   - width and height;
   - content type.
3. Register a constrained application protocol, for example:

   ```text
   xshot://capture/{sessionId}/{assetId}
   ```

4. Serve encoded preview bytes from the asset store with the correct MIME type.
5. Reject requests for unknown, expired, or cross-session asset IDs.
6. Use object URLs or protocol URLs in overlays and the editor.
7. Keep raw/native frames for cropping only as long as the session requires
   them.
8. Release assets on commit, cancel, timeout, renderer crash, and app quit.
9. Add explicit memory limits based on total stored pixels/bytes, not data URL
   string length.
10. Remove `dataUrl` fields from internal snapshot IPC types. Retain encoded
    data only at compatibility boundaries until later phases migrate them.

### Likely Files

- `src/main/main.ts`
- `src/main/ipc/screenshot.ts`
- `src/main/preload.ts`
- `src/shared/ipc-types.ts`
- `src/renderer/ScreenshotCapture.tsx`
- `src/renderer/App.tsx`

### Completion and Test Conditions

- [ ] No full-resolution display snapshot crosses IPC as a base64 string.
- [ ] Heap snapshots show only one retained full-resolution frame per stored
      display asset, excluding unavoidable decoder/GPU copies.
- [ ] Protocol requests cannot use `..`, encoded traversal, a different
      session ID, or an expired asset ID.
- [ ] Cancel releases all session assets within one second.
- [ ] A three-display 4K capture session stays within the documented memory
      budget.
- [ ] Repeating capture/cancel 50 times does not show monotonic main-process or
      renderer memory growth.
- [ ] Overlay and editor images remain valid for their intended lifetime and
      fail closed after asset release.

## Phase 3 — Native-Resolution Capture Provider

### Goal

Use thumbnails only for previews and source selection. Produce final screenshots
from a native-resolution frame source.

### Work

1. Define a capture provider interface:

   ```ts
   interface CaptureProvider {
     listSources(type: 'screen' | 'window'): Promise<CaptureSource[]>;
     captureFrame(source: CaptureSource): Promise<CapturedFrame>;
   }
   ```

2. Implement the first provider using the selected desktop source ID with a
   one-frame media stream at native dimensions.
3. Stop all media tracks immediately after the first valid frame.
4. Store the full-resolution frame in `CaptureAssetStore`.
5. Derive a smaller overlay preview from the same frame.
6. Match screen sources to Electron displays by `display_id`. Do not silently
   select a same-aspect-ratio source when an exact mapping is unavailable.
7. Return a typed, user-visible permission or source-mapping error.
8. Check macOS screen-recording permission before capture and provide a route
   to System Settings when denied.
9. Document Linux/Wayland limitations. Use the system PipeWire picker where the
   compositor does not expose global source enumeration or coordinates.
10. Keep native platform adapters as a later optimization:
    - macOS `SCScreenshotManager`;
    - Windows `Windows.Graphics.Capture`.

### Likely Files

- `src/main/capture/` (new)
- `src/main/ipc/screenshot.ts`
- `src/shared/ipc-types.ts`
- a dedicated hidden capture renderer if required by the media-stream approach

### Completion and Test Conditions

- [ ] A 5K display produces an image whose dimensions match the display's
      physical-pixel dimensions.
- [ ] A 2× display converts a 100×100 DIP selection to a 200×200 pixel crop.
- [ ] A 1× display converts the same selection to 100×100 pixels.
- [ ] Mixed-DPI display crops use the selected display's scale and frame bounds.
- [ ] Window capture output matches the acquired frame size and is not capped
      at 4096 pixels.
- [ ] Source mapping never falls back to an unrelated same-aspect-ratio screen.
- [ ] Every capture stops its media tracks, including error and cancellation
      paths.
- [ ] macOS denied/not-determined/granted permission states produce the expected
      UI and no blank screenshot is delivered as success.
- [ ] Windows capture works at 100%, 125%, 150%, and 200% display scaling.
- [ ] Supported Linux sessions use the expected portal/picker behavior; known
      Wayland limitations are documented.

## Phase 4 — Lightweight, Warmed Overlay Windows

### Goal

Reduce trigger-to-overlay latency and remove first-frame flashes without
changing the one-window-per-display model.

### Work

1. Create a dedicated overlay renderer entry point that does not import the
   editor, presentation assets, OCR, or Tesseract.
2. Create a minimal overlay preload exposing only:
   - ready;
   - pointer selection commit;
   - cancel;
   - source picker requests if they remain part of the overlay.
3. Maintain a hidden overlay-window pool synchronized with display
   add/remove/metrics events.
4. Keep pooled windows hidden while frames are captured.
5. Send session/display metadata after the preview asset is available.
6. Wait for each overlay to decode its preview and signal `overlay-ready`.
7. Show overlays together only after readiness or a defined timeout.
8. Place the quick dock on the display nearest the cursor.
9. Give the source panel an explicit stacking layer above dimming, selection,
   magnifier, and dock UI.
10. Focus the overlay interaction root automatically and handle Escape at the
    document or main-process level.
11. Remove fixed 8-pixel snapping. Support:
    - exact pixel/DIP movement by default;
    - optional modifier-based grid snapping;
    - clamping during move and resize.
12. Make the main window's current-space/always-on-top behavior independent
    from overlay behavior.

### Likely Files

- `src/main/windows.ts`
- `src/renderer/ScreenshotCapture.tsx`
- `src/renderer/hooks/use-selection.ts`
- `src/renderer/components/QuickDock.tsx`
- `src/renderer/components/SourcesPanel.tsx`
- Webpack renderer/preload configuration

### Completion and Test Conditions

- [ ] The overlay bundle contains no OCR worker, trained data, editor code, or
      presentation background imports.
- [ ] Warm trigger-to-visible latency meets the chosen target on reference
      hardware; recommended target: p95 below 150 ms after frame acquisition.
- [ ] No overlay is shown before its preview image has decoded.
- [ ] No background “pop-in,” transparent flash, or stale previous-session
      image is visible.
- [ ] The dock appears on the display containing the cursor.
- [ ] Escape cancels immediately before any mouse click.
- [ ] The source panel is visible and interactive above every overlay layer.
- [ ] A one-unit selection adjustment changes the final crop by the correct
      number of physical pixels for that display.
- [ ] Move and resize cannot place the selection outside display bounds.
- [ ] Display metrics changes update or recreate only the affected pooled
      overlay.

## Phase 5 — Editor Interaction Transactions and Rendering Performance

### Goal

Make drag, resize, and pen input smooth while producing useful undo history.

### Work

1. Add interaction transactions:
   - capture the initial scene at pointer-down;
   - maintain transient state during movement;
   - commit one history entry at pointer-up.
2. Ensure moving or resizing a shape creates one undo step.
3. Keep transient pointer state in refs or a reducer designed for high-frequency
   updates.
4. Batch visual updates to one per animation frame.
5. Use `getCoalescedEvents()` when available for pen/highlighter input.
6. Simplify completed pen paths with a documented tolerance.
7. Avoid repeated full-array snapshots while an interaction is active.
8. Introduce stable scene commands or patches if full-scene history remains
   expensive.
9. Cap history based on estimated memory as well as command count.

### Likely Files

- `src/renderer/hooks/use-editor-state.ts`
- `src/renderer/components/editor/ScreenshotEditor.tsx`
- `src/renderer/components/editor/editor-stage.tsx`

### Completion and Test Conditions

- [ ] Dragging a shape for five seconds creates exactly one undo entry.
- [ ] Resizing a PII mask creates exactly one undo entry and keeps persisted
      mask bounds synchronized.
- [ ] Undo restores the exact pre-gesture state; redo restores the final state.
- [ ] A 10-second pen stroke remains responsive and does not show quadratic
      processing growth.
- [ ] Pen simplification stays within the documented visual tolerance.
- [ ] Pointer-up outside the SVG still completes or cancels the transaction
      safely through pointer capture.
- [ ] A scene with the agreed stress-test shape count maintains the target
      interaction frame rate.
- [ ] History memory remains within its configured budget.

## Phase 6 — Demand-Driven OCR and PII Detection

### Goal

Avoid loading and running OCR for screenshots that do not need it, while making
repeated OCR faster and cancellable.

### Work

1. Replace the one-shot `recognize()` helper with a reusable `createWorker`
   lifecycle.
2. Lazily initialize the worker only when:
   - automatic PII detection is enabled; or
   - the text-selection feature is activated.
3. Queue recognition requests and reject stale results using the active
   screenshot/capture ID.
4. Cancel or ignore work when the screenshot changes or editor closes.
5. Terminate the worker on app shutdown and after a configurable idle period if
   memory pressure matters.
6. Keep OCR image preprocessing off the React render path.
7. Decide whether the 1200-pixel OCR limit is appropriate through accuracy
   fixtures. Make it configurable if necessary.
8. Upgrade Tesseract only in a separate change with migration tests for word,
   line, paragraph, and bounding-box output.
9. Store only mask geometry and detector tags. Do not persist recognized text by
   default.
10. Replace the current partial-prefix image hash with a collision-resistant
    digest of the capture asset bytes or stable capture ID.

### Likely Files

- `src/renderer/hooks/use-text-detection.ts`
- `src/renderer/hooks/use-pii-masking.ts`
- `src/renderer/hooks/pii/storage.ts`
- `src/renderer/hooks/pii/compute-masks.ts`

### Completion and Test Conditions

- [ ] Opening an editor with PII detection off and never selecting text does not
      create an OCR worker or load trained data.
- [ ] Enabling PII detection starts OCR once and applies masks after completion.
- [ ] Activating text selection starts OCR on demand.
- [ ] Repeated screenshots reuse one initialized worker.
- [ ] Switching screenshots during OCR never applies stale boxes or masks.
- [ ] Closing the editor during OCR does not produce state updates after
      unmount.
- [ ] Fixture tests measure detector precision/recall for each supported PII
      category.
- [ ] OCR bounding boxes align with both 1× and 2× screenshots.
- [ ] No OCR text or source screenshot data is written to logs or preferences.

## Phase 7 — Deterministic Scene Export

### Goal

Replace live-DOM rasterization with an output pipeline whose dimensions and
pixels are controlled by the editor scene.

### Work

1. Define an exportable scene model containing:
   - source image asset;
   - annotation shapes;
   - presentation background;
   - frame, inset, radius, and shadow settings;
   - output dimensions and scale.
2. Render the scene with one of these deterministic approaches:
   - preferred: `OffscreenCanvas`/Canvas 2D;
   - acceptable: generate one self-contained SVG, then rasterize it.
3. Render at final dimensions directly instead of scaling the visible editor
   DOM.
4. Implement explicit font loading/fallback behavior.
5. Implement blur/pixelation as an actual image operation. Keep secure export
   redaction opaque even if the editing preview uses blur.
6. Encode to Blob/bytes and pass binary data to clipboard/save boundaries.
7. Preserve alpha for PNG and define background flattening for JPEG.
8. Until DOM export is removed, fix its memory-scale calculation:

   ```text
   finalScale = min(
     requestedScale,
     sqrt(maxBytes / (baseWidth * baseHeight * bytesPerPixel))
   )
   ```

9. Return typed export errors instead of treating invalid input, encoding
   failure, and user cancellation as the same result.

### Likely Files

- `src/renderer/components/editor/editor-export.ts`
- `src/renderer/components/editor/editor-export-dom.ts`
- `src/renderer/components/editor/editor-stage.tsx`
- `src/renderer/hooks/use-export-glue.ts`
- `src/main/ipc/files.ts`

### Completion and Test Conditions

- [ ] A 1000×500 scene exported at 1× is exactly 1000×500 pixels.
- [ ] The same scene at 2× is exactly 2000×1000 pixels.
- [ ] Memory limiting selects the mathematically correct scale and never
      unexpectedly drops a 4× request below 1× when a higher safe scale fits.
- [ ] Golden-image tests cover every annotation type and presentation setting.
- [ ] Export output is independent of editor zoom and pan.
- [ ] Selection handles, OCR overlays, controls, and transient shapes are never
      exported.
- [ ] PII regions are irreversibly redacted in exported pixel data.
- [ ] PNG preserves transparency where expected.
- [ ] JPEG contains no unintended transparent/black alpha areas.
- [ ] Missing fonts and failed image decode produce a typed, user-visible error.
- [ ] Repeating a large export does not cause monotonic renderer memory growth.

## Phase 8 — File, Background Asset, and Preference Persistence

### Goal

Prevent accidental overwrites, broken uploaded backgrounds, and excessive
preference writes.

### Work

1. Make auto-save filenames collision-safe:
   - use exclusive file creation;
   - append `-1`, `-2`, and so on when a name exists;
   - never silently overwrite an existing capture.
2. Return distinct save results:
   - success;
   - user canceled;
   - invalid input;
   - permission denied;
   - encoding failed;
   - write failed.
3. Attach save/open dialogs to the appropriate parent window.
4. Store uploaded presentation backgrounds as managed files under `userData`.
5. Persist an asset ID or managed relative path instead of a data URL.
6. Validate uploaded image type, decoded dimensions, and maximum size.
7. Add cleanup behavior for replaced/orphaned managed backgrounds.
8. Keep immediate presentation UI state in the renderer and debounce preference
   writes.
9. Make preference writes atomic using write-to-temp then rename.
10. Deep-merge and validate nested preference updates.

### Likely Files

- `src/main/ipc/files.ts`
- `src/main/preferences.ts`
- `src/main/ipc/preferences.ts`
- `src/renderer/hooks/use-presentation-state.ts`
- `src/renderer/components/editor/PresentationPanel.tsx`

### Completion and Test Conditions

- [ ] Two auto-saves with the same filename pattern create two distinct files.
- [ ] A filename pattern without date/time never overwrites an existing file.
- [ ] Canceling a save dialog is reported as cancellation, not an error.
- [ ] Permission and disk-write failures produce distinct user-visible errors.
- [ ] Uploaded backgrounds larger than the former data URL limit persist and
      reload correctly.
- [ ] Malformed or oversized background files are rejected without modifying
      existing preferences.
- [ ] Dragging a presentation slider for five seconds results in bounded,
      debounced preference writes rather than one write per input event.
- [ ] Killing the app during a preference write leaves either the old valid file
      or the new valid file, never truncated JSON.
- [ ] Partial nested preference updates preserve unrelated detector,
      presentation, and capture settings.

## Phase 9 — Security, Packaging, and Platform Hardening

### Goal

Reduce renderer privileges and harden packaged applications after the new
capture and protocol boundaries are stable.

### Work

1. Validate the sender frame/window for every privileged IPC handler.
2. Replace generic route-wide IPC access with explicit APIs in separate
   preloads:
   - editor;
   - overlay;
   - preferences;
   - hidden capture renderer, if used.
3. Block unexpected top-level navigation with `will-navigate`.
4. Continue denying new windows and allow only explicitly approved external
   HTTPS URLs.
5. Serve packaged UI from a constrained custom protocol instead of `file://`.
6. Keep the CSP strict and document why each exception is required.
7. Enable appropriate Electron fuses:
   - disable `RunAsNode`;
   - disable `NODE_OPTIONS`;
   - disable CLI inspect arguments in production;
   - enable embedded ASAR integrity validation;
   - enable only-load-from-ASAR.
8. Review macOS entitlements and remove capabilities not required by tested app
   functionality, especially Apple Events and library-validation exceptions.
9. Ensure notarization is mandatory for production release jobs.
10. Remove production source maps from distributed packages unless they are
    intentionally uploaded to a private error-reporting service.
11. Remove or correctly place `app.disableHardwareAcceleration()`. The
    recommended default is to retain hardware acceleration and measure actual
    GPU-specific defects before disabling it.
12. Add dependency and packaged-artifact checks to release CI.

### Likely Files

- `src/main/preload.ts`
- `src/main/windows.ts`
- `src/main/main.ts`
- `src/main/ipc/*.ts`
- `src/main/util.ts`
- `src/renderer/index.ejs`
- `assets/entitlements.mac.plist`
- `.erb/scripts/notarize.js`
- Electron Builder configuration in `package.json`

### Completion and Test Conditions

- [ ] An unexpected renderer or subframe cannot invoke capture, file,
      preference, or window-control operations.
- [ ] Navigating any application window to an unapproved URL is blocked.
- [ ] Approved external links open in the system browser and never receive the
      preload bridge.
- [ ] The custom application protocol cannot read files outside packaged
      renderer assets.
- [ ] Production CSP reports no unexpected violations during the complete
      capture/edit/export workflow.
- [ ] Packaged macOS and Windows apps fail to start after intentional ASAR
      tampering.
- [ ] Production builds do not honor `ELECTRON_RUN_AS_NODE`, `NODE_OPTIONS`, or
      inspect flags.
- [ ] The macOS app passes signing, hardened-runtime, notarization, and
      Gatekeeper verification.
- [ ] The Windows installer and executable pass signing verification.
- [ ] Distributed artifacts do not contain source maps unless explicitly
      approved.
- [ ] Capture, overlay transparency, editor rendering, and export still work
      after entitlement and fuse changes.

## Phase 10 — Full Regression Matrix and Release Gate

### Goal

Validate the complete replacement pipeline before making it the only path.

### Work

1. Run automated unit, integration, and golden-image suites.
2. Run the hardware/platform matrix below.
3. Compare latency, memory, dimensions, and export fidelity to the Phase 0
   baseline.
4. Keep the old pipeline behind a development-only feature flag until the new
   path passes the release gate.
5. Remove the old implementation, compatibility data URL types, and obsolete
   tests only after approval.

### Platform Matrix

- macOS:
  - Intel and Apple Silicon;
  - 1× external display;
  - Retina display;
  - mixed-DPI multi-display;
  - display left/above primary;
  - full-screen Space;
  - screen-recording permission granted and denied.
- Windows:
  - 100%, 125%, 150%, and 200% scaling;
  - mixed-DPI displays;
  - secondary display left/above primary;
  - HDR enabled where available;
  - Windows 10 and Windows 11 supported versions.
- Linux, if retained as supported:
  - X11;
  - Wayland/PipeWire portal;
  - documented compositor limitations.

### Completion and Test Conditions

- [ ] All automated checks pass from a clean checkout.
- [ ] Every platform-matrix capture has correct source, crop, dimensions, and
      orientation.
- [ ] No test capture includes an X-Shot window unless explicitly selecting the
      X-Shot window as a window source.
- [ ] p50 and p95 latency are no worse than the accepted Phase 0 baseline and
      meet the product target.
- [ ] Repeating 100 capture/cancel cycles shows no sustained leak.
- [ ] Repeating 50 capture/edit/export cycles shows no sustained leak.
- [ ] Clipboard and saved-file pixels match the editor export.
- [ ] PII export fixtures cannot recover original pixels from redacted areas.
- [ ] Crash recovery leaves no active media tracks, overlay windows, temporary
      files, or orphaned capture assets.
- [ ] The development fallback flag is removed or explicitly scheduled for
      removal before release.

## Recommended Pull Request Boundaries

Keep changes reviewable and reversible. A practical PR sequence is:

1. Baseline fixtures and instrumentation.
2. Capture session coordinator.
3. Awaited teardown and recapture correction.
4. Capture asset store and protocol.
5. Native-resolution capture provider.
6. Minimal overlay bundle.
7. Warm overlay pool and readiness handshake.
8. Editor interaction transactions.
9. Lazy reusable OCR worker.
10. Deterministic export renderer.
11. Collision-safe saving and managed backgrounds.
12. IPC/protocol/navigation hardening.
13. Fuses, entitlements, signing, and release gate.

Each PR should include its phase-specific tests and should not combine capture,
editor, export, and packaging migrations unless a narrow dependency makes that
unavoidable.

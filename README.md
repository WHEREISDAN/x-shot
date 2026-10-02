# X-Shot

A powerful screenshot capture and editing app built with Electron and React. X‑Shot lives in your system tray, lets you capture any screen or window, and includes advanced editing with PII masking, text detection (OCR), and polished presentation exports.

![Preview](https://i.imgur.com/CV2LHi4.png)

## Features

- **Instant capture**: Global hotkey (default: CommandOrControl+Shift+1) and tray menu
- **Selection + recapture**: Area selection overlays with optional recapture of last area
- **Advanced editing**: Rectangle, ellipse, arrow, freehand pen, and text tools
- **PII masking**: Automatic detection plus manual masking of sensitive data
- **Text detection (OCR)**: Extract text from screenshots using Tesseract.js
- **Presentation mode**: Background gradients/images, padding, radius, shadows, and aspect presets
- **Export options**: Copy to clipboard or save to file (configurable filename pattern and scale)
- **Multi-display support**: Capture from any connected display or app window
- **Preferences**: Hotkeys (including delayed capture), exports, editor defaults, privacy, and tray visibility

## Getting Started

### Prerequisites
- Node.js 22 (the version CI uses) and npm
- macOS, Windows, or Linux

### Install
```bash
git clone https://github.com/WHEREISDAN/x-shot.git
cd x-shot
npm install
```

### Development
Start in development with HMR:
```bash
npm start
```

Helpful scripts:
```bash
npm run start:main    # Watch/rebuild main process with auto-restart
npm run build         # Build main and renderer for production
npm test              # Run Jest tests (jsdom)
npm run package:dir   # Unpacked build in release/build/smoke (run `npm run build` first)
npm run test:smoke    # Playwright smoke tests against that build
npm run check:package # Check the packaged app.asar: size, no source maps, no node_modules
npm run lint          # ESLint checks
npm run lint:fix      # ESLint with auto-fix
```

### Package for Distribution
```bash
npm run package
```
Output is written to `release/build/` for your platform. This first deletes `release/build/` and `release/app/dist/`.

### Releasing
1. Set `version` in `release/app/package.json`; that is the app's version.
2. Commit it, then push a matching tag: `git tag v1.0.2 && git push origin v1.0.2`.
3. The Publish workflow runs the full test suite, builds the macOS, Windows and Linux installers, and uploads them to a draft GitHub release to review and publish. A tag that does not match the version stops it.

Signing and notarization run only when these repository secrets exist. Without them the build is unsigned and the workflow log says why.

| Secret | Used for |
|---|---|
| `CSC_LINK` | macOS "Developer ID Application" certificate (.p12), base64-encoded |
| `CSC_KEY_PASSWORD` | Password of that .p12 |
| `APPLE_ID` | Apple ID used to notarize |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password of that Apple ID |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WIN_CSC_LINK` (optional) | Windows code-signing certificate (.pfx), base64-encoded |
| `WIN_CSC_KEY_PASSWORD` (optional) | Password of that .pfx |

Only a signed app can be notarized, so the Apple secrets do nothing without `CSC_LINK` and `CSC_KEY_PASSWORD`. Setting only part of a group fails the workflow with a message naming what is missing.

## Usage

1. Launch the app. X‑Shot runs in the system tray.
2. Press the global hotkey (default: CommandOrControl+Shift+1) or use the tray menu to start a capture.
3. Select the area or window to capture using the fullscreen overlay.
4. Edit in the editor window: annotate, mask PII, enable presentation mode, etc.
5. Export by copying to clipboard or saving to a file.

### Keyboard Shortcuts
- **Main capture**: CommandOrControl+Shift+1 (default; override via env `XSHOT_HOTKEY` or Preferences)
- **Delayed capture**: Optional 3s/5s hotkeys (configure in Preferences)
- **Recapture last selection**: Optional hotkey to repeat the prior area

## Architecture

X‑Shot follows Electron’s two‑process model with strict boundaries:

- **Main** (`src/main/`): App lifecycle, tray, menu, hotkeys, screenshot pipeline, file/clipboard, IPC handlers
- **Preload** (`src/main/preload.ts`): Secure bridge (contextIsolation on; `window.electron` API only)
- **Renderer** (`src/renderer/`): React UI with routes `/` (editor), `/screenshot` (overlay), `/preferences`

Typed IPC channels live in `src/shared/ipc-types.ts` and are used across main, preload, and renderer.

## Configuration

- **Hotkey override**: `XSHOT_HOTKEY` environment variable sets the default accelerator
- **Preferences**: Persisted app settings for capture, editor, export, system/tray, PII, and presentation

## Tech Stack

- Electron, electron-builder, electron-log
- React 19, React Router, TypeScript
- Webpack 5 (separate configs for main/renderer/preload)
- Jest + ts-jest (jsdom)
- Tesseract.js (OCR)

## Links

- Issue tracker: `https://github.com/WHEREISDAN/x-shot/issues`
- Repository: `https://github.com/WHEREISDAN/x-shot`
- Author: `https://www.whereisdan.dev`

## License

MIT

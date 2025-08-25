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
- Node.js >= 14 and npm >= 7 (see `package.json` devEngines)
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
npm run lint          # ESLint checks
npm run lint:fix      # ESLint with auto-fix
```

### Package for Distribution
```bash
npm run package
```
Output is written to `release/build/` for your platform.

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

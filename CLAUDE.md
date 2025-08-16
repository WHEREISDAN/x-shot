# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

X-Shot is a screenshot capture and editing application built with Electron and React. The app runs in the system tray and provides advanced screenshot functionality with editing capabilities including PII masking, text detection, and presentation modes.

## Core Development Commands

```bash
npm start              # Start app in development mode with HMR
npm run build          # Build both main and renderer for production
npm run package        # Package app for distribution (output in release/build/)
npm test              # Run Jest tests with ts-jest
npm run lint          # Run ESLint checks
npm run lint:fix      # Run ESLint and auto-fix issues
npm run start:main    # Watch/rebuild main process with auto-restart
```

### Single Test Execution
```bash
npm test -- --testNamePattern="test name"     # Run specific test by name
npm test -- ScreenshotEditor.test.tsx         # Run specific test file
```

## Architecture

### Two-Process Model
The application follows Electron's two-process architecture with strict security boundaries:

1. **Main Process** (`src/main/`)
   - Manages app lifecycle, system tray, and window creation
   - Handles native OS operations (screenshots, file saving, clipboard)
   - Global hotkey registration (default: Cmd+Shift+4 on macOS)
   - IPC handlers for secure communication with renderer

2. **Renderer Process** (`src/renderer/`)
   - React application for UI and user interactions
   - Two main routes:
     - `/` - Main editor window for screenshot editing
     - `/screenshot` - Fullscreen overlay for area selection
   - All native operations go through IPC via preload bridge

### Key Entry Points
- **Main**: `src/main/main.ts` - Creates tray icon, registers hotkeys, manages windows
- **Preload**: `src/main/preload.ts` - Secure IPC bridge using contextBridge
- **Renderer**: `src/renderer/index.tsx` - React app bootstrap
- **App Routes**: `src/renderer/App.tsx` - Route definitions and app shell

### Screenshot Capture Flow
1. User triggers screenshot (tray menu or hotkey)
2. Main process creates fullscreen overlay windows (one per display)
3. User selects area or window in `ScreenshotCapture` component
4. Selection sent to main process via IPC
5. Main captures screenshot and opens editor window
6. `ScreenshotEditor` component provides editing tools

### Editor Features
- **Shape Tools**: Rectangle, ellipse, arrow, pen drawing, text
- **PII Masking**: Automatic detection and manual masking of sensitive data
- **Text Detection**: OCR using Tesseract.js for text extraction
- **Presentation Mode**: Add padding, backgrounds, and professional styling
- **Export Options**: Copy to clipboard, save to file with various formats

### IPC Security Model
- **No Direct Node Access**: `nodeIntegration: false`, `contextIsolation: true`
- **Typed IPC**: All IPC channels defined in `src/shared/ipc-types.ts`
- **Preload Bridge**: Only approved APIs exposed via `window.electron`
- **Handler Registration**: Separate modules for file, screenshot, and window operations

### State Management
- React hooks for local component state
- Custom hooks for complex features:
  - `useEditorState` - Shape management and editing tools
  - `usePiiMasking` - PII detection and masking
  - `usePresentationState` - Presentation mode settings
  - `useTextDetection` - OCR functionality

### Build System
- **Webpack**: Separate configs for main/renderer/preload in `.erb/configs/`
- **TypeScript**: Strict mode enabled, es2022 target
- **electron-builder**: Cross-platform packaging configuration in `package.json`
- **DLL**: Development DLL for faster rebuilds (`npm run build:dll`)

## Testing Strategy
- **Framework**: Jest with ts-jest for TypeScript support
- **Environment**: jsdom for React component testing
- **Location**: Tests in `src/__tests__/`
- **Coverage**: Focus on IPC types, React components, and critical business logic
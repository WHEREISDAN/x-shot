# X-Shot

A powerful screenshot capture and editing application built with Electron and React. X-Shot runs in your system tray and provides advanced screenshot functionality with editing capabilities including PII masking, text detection, and presentation modes.

## Features

- **Quick Capture**: Global hotkey support (Cmd+Shift+4 on macOS) for instant screenshots
- **Advanced Editing**: Rectangle, ellipse, arrow, pen drawing, and text tools
- **PII Masking**: Automatic detection and manual masking of sensitive information
- **Text Detection**: OCR functionality using Tesseract.js for text extraction
- **Presentation Mode**: Add padding, backgrounds, and professional styling to screenshots
- **Multiple Export Options**: Copy to clipboard or save to file in various formats
- **Multi-Display Support**: Capture from any connected display

## Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/yourusername/x-shot.git
cd x-shot
npm install
```

## Development

Start the app in development mode with hot module replacement:

```bash
npm start
```

### Other Development Commands

```bash
npm run start:main    # Watch/rebuild main process with auto-restart
npm run build         # Build both main and renderer for production
npm test              # Run Jest tests
npm run lint          # Run ESLint checks
npm run lint:fix      # Run ESLint and auto-fix issues
```

## Building for Production

Package the application for distribution:

```bash
npm run package
```

The packaged application will be available in the `release/build/` directory.

## Architecture Overview

X-Shot follows Electron's two-process architecture:

### Main Process
- Manages app lifecycle and system tray
- Handles native OS operations (screenshots, file operations)
- Global hotkey registration
- Window creation and management

### Renderer Process
- React application for UI
- Screenshot selection overlay
- Advanced editor with drawing tools
- PII masking and text detection features

## Usage

1. **Launch the app** - X-Shot will appear in your system tray
2. **Take a screenshot** - Use the hotkey (Cmd+Shift+4) or click the tray icon
3. **Select area** - Click and drag to select the area you want to capture
4. **Edit** - Use the editing tools to annotate, mask PII, or enhance your screenshot
5. **Export** - Copy to clipboard or save to file

## Testing

Run the test suite:

```bash
npm test
```

Run a specific test:

```bash
npm test -- --testNamePattern="test name"
npm test -- ScreenshotEditor.test.tsx
```

## Technologies

- **Electron** - Cross-platform desktop application framework
- **React** - UI component library
- **TypeScript** - Type-safe JavaScript
- **Webpack** - Module bundler
- **Jest** - Testing framework
- **Tesseract.js** - OCR for text detection

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
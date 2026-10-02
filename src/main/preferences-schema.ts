import type {
  AppPreferences,
  BackgroundImageRef,
} from '../shared/preferences-types';
import { isBackgroundId } from '../shared/capture-asset';
import { isBuiltinBackgroundId } from '../shared/builtin-backgrounds';
import { isPlainObject, type PlainRecord } from '../shared/deep-merge';

export { deepMerge, isPlainObject } from '../shared/deep-merge';

const SECTIONS = [
  'capture',
  'editor',
  'export',
  'system',
  'pii',
  'presentation',
] as const;

/** Defaults; `picturesDir` is where captures are saved unless changed. */
export function createDefaultPreferences(picturesDir: string): AppPreferences {
  return {
    capture: {
      hotkey: 'CommandOrControl+Shift+1',
      hotkeyDelay3: null,
      hotkeyDelay5: null,
      hotkeyRecapture: null,
      defaultSaveLocation: picturesDir,
      autoCopyToClipboard: false,
      defaultFormat: 'png',
      lastSelection: null,
    },
    editor: {
      defaultStrokeColor: '#ef4444',
      defaultFillColor: 'transparent',
      defaultStrokeWidth: 3,
      defaultTextSize: 18,
    },
    export: {
      filenamePattern: 'X-Shot_$TIMESTAMP',
      autoSave: false,
      defaultScale: 1,
    },
    system: {
      launchAtStartup: false,
      showInTray: true,
    },
    pii: {
      autoDetect: false,
      defaultStyle: 'black',
      detectors: {
        email: true,
        phone: true,
        address: true,
        ipv4: false,
        url: false,
        ssn: false,
        creditCard: false,
        dob: false,
        postalUS: false,
        postalCA: false,
        postalUK: false,
        uuid: false,
        mac: false,
        iban: false,
        poBox: false,
        tokens: false,
      },
    },
    presentation: {
      gradient: {
        kind: 'linear',
        angleDeg: 45,
        stops: [
          { offset: 0, color: '#7c3aed' },
          { offset: 1, color: '#22d3ee' },
        ],
      },
      backgroundImage: null,
      padding: 48,
      inset: 16,
      radius: 24,
      shadow: {
        enabled: true,
        x: 0,
        y: 18,
        blur: 48,
        spread: 4,
        color: 'rgba(0,0,0,0.35)',
      },
      aspect: { preset: 'auto' },
      borderColor: '#0b0b0c',
    },
  };
}

const INVALID_FILENAME_PATTERN_CHARS = new RegExp(
  `[\\\\/:*?"<>|${String.fromCharCode(0)}-${String.fromCharCode(31)}]`,
  'g',
);

function finiteNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function stringValue(
  value: unknown,
  fallback: string,
  maxLength = 4096,
): string {
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/\0/g, '').trim();
  if (!cleaned) return fallback;
  return cleaned.slice(0, maxLength);
}

function nullableHotkey(
  value: unknown,
  fallback: string | null,
): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string') return fallback;
  const cleaned = value.replace(/[\0\r\n]/g, '').trim();
  if (!cleaned || cleaned.length > 80) return fallback;
  return cleaned;
}

function hotkeyValue(value: unknown, fallback: string): string {
  return nullableHotkey(value, fallback) || fallback;
}

function colorValue(value: unknown, fallback: string): string {
  return stringValue(value, fallback, 128);
}

export function sanitizeFilenamePattern(
  value: unknown,
  fallback = 'X-Shot_$TIMESTAMP',
): string {
  const pattern = stringValue(value, fallback, 160)
    .replace(INVALID_FILENAME_PATTERN_CHARS, '-')
    .replace(/\.+$/g, '')
    .trim();
  return pattern || fallback;
}

function sanitizeLastSelection(
  value: unknown,
  fallback: AppPreferences['capture']['lastSelection'],
): AppPreferences['capture']['lastSelection'] {
  if (value === null) return null;
  if (!isPlainObject(value)) return fallback;
  const { x, y, width, height, displayId } = value;
  if (
    typeof x !== 'number' ||
    !Number.isFinite(x) ||
    typeof y !== 'number' ||
    !Number.isFinite(y) ||
    typeof width !== 'number' ||
    !Number.isFinite(width) ||
    width <= 0 ||
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height <= 0 ||
    typeof displayId !== 'number' ||
    !Number.isFinite(displayId)
  ) {
    return fallback;
  }
  return {
    x,
    y,
    width,
    height,
    displayId,
  };
}

function sanitizeDetectors(
  value: unknown,
  fallback: AppPreferences['pii']['detectors'],
): AppPreferences['pii']['detectors'] {
  const source = isPlainObject(value) ? value : {};
  return Object.fromEntries(
    Object.entries(fallback).map(([key, defaultValue]) => [
      key,
      typeof source[key] === 'boolean' ? source[key] : defaultValue,
    ]),
  ) as AppPreferences['pii']['detectors'];
}

function sanitizeBackgroundImage(
  value: unknown,
  fallback: BackgroundImageRef | null,
): BackgroundImageRef | null {
  if (value === null) return null;
  if (!isPlainObject(value)) return fallback;
  if (value.kind === 'file' && isBackgroundId(value.id)) {
    return { kind: 'file', id: value.id };
  }
  if (value.kind === 'builtin' && isBuiltinBackgroundId(value.id)) {
    return { kind: 'builtin', id: value.id };
  }
  return fallback;
}

function sanitizePresentation(
  value: unknown,
  fallback: AppPreferences['presentation'],
): AppPreferences['presentation'] {
  const isAspectPreset = (
    preset: unknown,
  ): preset is AppPreferences['presentation']['aspect']['preset'] =>
    typeof preset === 'string' &&
    ['auto', '1:1', '4:3', '3:2', '16:9', '9:16', 'custom'].includes(preset);
  const source = isPlainObject(value) ? value : {};
  const gradient = isPlainObject(source.gradient) ? source.gradient : {};
  const fallbackGradient = fallback.gradient;
  const rawStops = Array.isArray(gradient.stops) ? gradient.stops : [];
  const stops = rawStops
    .filter(isPlainObject)
    .slice(0, 8)
    .map((stop, index) => ({
      offset: finiteNumber(
        stop.offset,
        fallbackGradient.stops[index]?.offset ?? 0,
        0,
        1,
      ),
      color: colorValue(
        stop.color,
        fallbackGradient.stops[index]?.color ?? '#000000',
      ),
    }));
  const shadow = isPlainObject(source.shadow) ? source.shadow : {};
  const fallbackShadow = fallback.shadow;
  const aspect = isPlainObject(source.aspect) ? source.aspect : {};
  const preset: AppPreferences['presentation']['aspect']['preset'] =
    isAspectPreset(aspect.preset) ? aspect.preset : fallback.aspect.preset;
  const custom = isPlainObject(aspect.custom)
    ? {
        w: finiteNumber(
          aspect.custom.w,
          fallback.aspect.custom?.w ?? 16,
          1,
          100,
        ),
        h: finiteNumber(
          aspect.custom.h,
          fallback.aspect.custom?.h ?? 9,
          1,
          100,
        ),
      }
    : fallback.aspect.custom;

  return {
    gradient: {
      kind: gradient.kind === 'radial' ? 'radial' : 'linear',
      angleDeg: finiteNumber(
        gradient.angleDeg,
        fallbackGradient.angleDeg,
        0,
        360,
      ),
      stops: stops.length > 0 ? stops : fallbackGradient.stops,
    },
    backgroundImage: sanitizeBackgroundImage(
      source.backgroundImage,
      fallback.backgroundImage,
    ),
    padding: finiteNumber(source.padding, fallback.padding, 0, 512),
    inset: finiteNumber(source.inset, fallback.inset, 0, 256),
    radius: finiteNumber(source.radius, fallback.radius, 0, 512),
    shadow: {
      enabled:
        typeof shadow.enabled === 'boolean'
          ? shadow.enabled
          : fallbackShadow.enabled,
      x: finiteNumber(shadow.x, fallbackShadow.x, -200, 200),
      y: finiteNumber(shadow.y, fallbackShadow.y, -200, 200),
      blur: finiteNumber(shadow.blur, fallbackShadow.blur, 0, 300),
      spread: finiteNumber(shadow.spread, fallbackShadow.spread, -100, 100),
      color: colorValue(shadow.color, fallbackShadow.color),
    },
    aspect: preset === 'custom' ? { preset, custom } : { preset },
    borderColor: colorValue(source.borderColor, fallback.borderColor),
  };
}

/** Every field valid; anything invalid or missing comes from `fallback`. */
export function sanitizePreferences(
  value: unknown,
  fallback: AppPreferences,
): AppPreferences {
  const preferences: PlainRecord = isPlainObject(value) ? value : {};
  const capture: PlainRecord = isPlainObject(preferences.capture)
    ? preferences.capture
    : {};
  const editor: PlainRecord = isPlainObject(preferences.editor)
    ? preferences.editor
    : {};
  const exportPrefs: PlainRecord = isPlainObject(preferences.export)
    ? preferences.export
    : {};
  const system: PlainRecord = isPlainObject(preferences.system)
    ? preferences.system
    : {};
  const pii: PlainRecord = isPlainObject(preferences.pii)
    ? preferences.pii
    : {};

  return {
    capture: {
      hotkey: hotkeyValue(capture.hotkey, fallback.capture.hotkey),
      hotkeyDelay3: nullableHotkey(
        capture.hotkeyDelay3,
        fallback.capture.hotkeyDelay3 ?? null,
      ),
      hotkeyDelay5: nullableHotkey(
        capture.hotkeyDelay5,
        fallback.capture.hotkeyDelay5 ?? null,
      ),
      hotkeyRecapture: nullableHotkey(
        capture.hotkeyRecapture,
        fallback.capture.hotkeyRecapture ?? null,
      ),
      defaultSaveLocation: stringValue(
        capture.defaultSaveLocation,
        fallback.capture.defaultSaveLocation,
      ),
      autoCopyToClipboard:
        typeof capture.autoCopyToClipboard === 'boolean'
          ? capture.autoCopyToClipboard
          : fallback.capture.autoCopyToClipboard,
      defaultFormat:
        capture.defaultFormat === 'jpg' || capture.defaultFormat === 'png'
          ? capture.defaultFormat
          : fallback.capture.defaultFormat,
      lastSelection: sanitizeLastSelection(
        capture.lastSelection,
        fallback.capture.lastSelection ?? null,
      ),
    },
    editor: {
      defaultStrokeColor: colorValue(
        editor.defaultStrokeColor,
        fallback.editor.defaultStrokeColor,
      ),
      defaultFillColor: colorValue(
        editor.defaultFillColor,
        fallback.editor.defaultFillColor,
      ),
      defaultStrokeWidth: finiteNumber(
        editor.defaultStrokeWidth,
        fallback.editor.defaultStrokeWidth,
        1,
        64,
      ),
      defaultTextSize: finiteNumber(
        editor.defaultTextSize,
        fallback.editor.defaultTextSize,
        8,
        256,
      ),
    },
    export: {
      filenamePattern: sanitizeFilenamePattern(
        exportPrefs.filenamePattern,
        fallback.export.filenamePattern,
      ),
      autoSave:
        typeof exportPrefs.autoSave === 'boolean'
          ? exportPrefs.autoSave
          : fallback.export.autoSave,
      defaultScale: finiteNumber(
        exportPrefs.defaultScale,
        fallback.export.defaultScale,
        0.25,
        4,
      ),
    },
    system: {
      launchAtStartup:
        typeof system.launchAtStartup === 'boolean'
          ? system.launchAtStartup
          : fallback.system.launchAtStartup,
      showInTray:
        typeof system.showInTray === 'boolean'
          ? system.showInTray
          : fallback.system.showInTray,
    },
    pii: {
      autoDetect:
        typeof pii.autoDetect === 'boolean'
          ? pii.autoDetect
          : fallback.pii.autoDetect,
      defaultStyle:
        pii.defaultStyle === 'blur' || pii.defaultStyle === 'black'
          ? pii.defaultStyle
          : fallback.pii.defaultStyle,
      detectors: sanitizeDetectors(pii.detectors, fallback.pii.detectors),
    },
    presentation: sanitizePresentation(
      preferences.presentation,
      fallback.presentation,
    ),
  };
}

/**
 * A well-formed update: an object whose keys are preference sections, each
 * an object. Field values are checked later by sanitizePreferences.
 */
export function isPreferencesUpdate(value: unknown): boolean {
  if (!isPlainObject(value)) return false;
  return Object.entries(value).every(
    ([key, section]) =>
      (SECTIONS as readonly string[]).includes(key) &&
      (section === undefined || isPlainObject(section)),
  );
}

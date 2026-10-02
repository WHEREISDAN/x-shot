/**
 * @jest-environment node
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import type {
  AppPreferences,
  PreferencesUpdate,
} from '../shared/preferences-types';
import { createBackgroundStore } from '../main/background-images';
import { createDefaultPreferences } from '../main/preferences-schema';
import {
  createPreferencesStore,
  type PreferencesStoreOptions,
} from '../main/preferences-store';
import { nodeFileOps, type AtomicFileOps } from '../main/atomic-write';

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const DEFAULTS = createDefaultPreferences('/home/user/Pictures');

let dir: string;
let filePath: string;
let log: { info: jest.Mock; warn: jest.Mock; error: jest.Mock };

const backgroundsDir = () => path.join(dir, 'backgrounds');

function makeStore(options: Partial<PreferencesStoreOptions> = {}) {
  const backgrounds = createBackgroundStore(backgroundsDir());
  return createPreferencesStore({
    filePath,
    defaults: DEFAULTS,
    saveBackground: (bytes) => backgrounds.save(bytes).catch(() => null),
    log,
    ...options,
  });
}

const readDisk = (): AppPreferences =>
  JSON.parse(fs.readFileSync(filePath, 'utf-8'));
const writeDisk = (value: unknown) =>
  fs.writeFileSync(filePath, JSON.stringify(value));
const tempFiles = () =>
  fs.readdirSync(dir).filter((name) => name.endsWith('.tmp'));

/** PNG-signed bytes of the given size. */
function pngBytes(size: number): Buffer {
  const bytes = Buffer.alloc(size);
  Buffer.from(PNG_SIGNATURE).copy(bytes);
  for (let i = PNG_SIGNATURE.length; i < size; i += 1) bytes[i] = i % 251;
  return bytes;
}

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-prefs-test-'));
  filePath = path.join(dir, 'preferences.json');
  log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('writes', () => {
  it('keeps 50 concurrent writes consistent; the file ends as the last', async () => {
    const store = makeStore();
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        store.update({
          editor: { defaultStrokeWidth: (i % 60) + 1 },
          export: { filenamePattern: `shot-${i}` },
        }),
      ),
    );

    results.forEach((result, i) =>
      expect(result.export.filenamePattern).toBe(`shot-${i}`),
    );
    expect(readDisk()).toEqual(results[49]);
    expect(await store.load()).toEqual(results[49]);
    expect(await makeStore().load()).toEqual(results[49]);
    expect(tempFiles()).toEqual([]);
  });

  it('keeps updates to different keys made in the same tick', async () => {
    const store = makeStore();
    await Promise.all([
      store.update({ editor: { defaultStrokeWidth: 9 } }),
      store.update({ editor: { defaultTextSize: 30 } }),
      store.update({ capture: { autoCopyToClipboard: true } }),
    ]);
    const onDisk = readDisk();
    expect(onDisk.editor.defaultStrokeWidth).toBe(9);
    expect(onDisk.editor.defaultTextSize).toBe(30);
    expect(onDisk.capture.autoCopyToClipboard).toBe(true);
  });

  it('updates the in-memory copy before the write finishes', async () => {
    const store = makeStore();
    await store.load();
    const pending = store.update({ export: { autoSave: true } });
    expect((await store.load()).export.autoSave).toBe(true);
    await pending;
  });

  it('reports a failed write and keeps the previous file', async () => {
    let failRename = false;
    const fileOps: AtomicFileOps = {
      ...nodeFileOps,
      rename: (from, to) =>
        failRename
          ? Promise.reject(
              Object.assign(new Error('disk full'), { code: 'ENOSPC' }),
            )
          : nodeFileOps.rename(from, to),
    };
    const store = makeStore({ fileOps });
    await store.update({ export: { filenamePattern: 'before' } });

    failRename = true;
    await expect(
      store.update({ export: { filenamePattern: 'after' } }),
    ).rejects.toThrow('disk full');
    expect(readDisk().export.filenamePattern).toBe('before');
    expect(tempFiles()).toEqual([]);

    // Later writes still go through.
    failRename = false;
    await store.update({ export: { autoSave: true } });
    expect(readDisk().export).toMatchObject({
      filenamePattern: 'after',
      autoSave: true,
    });
  });

  it('survives a crash mid-write: the previous file stays intact', async () => {
    await makeStore().update({ export: { filenamePattern: 'safe' } });

    // The process dies while writing the temp file: half the data lands
    // and nothing cleans up.
    const crashing: AtomicFileOps = {
      ...nodeFileOps,
      writeAndSync: async (tempPath, data) => {
        fs.writeFileSync(tempPath, String(data).slice(0, 40));
        throw new Error('crashed');
      },
      remove: async () => {},
    };
    await expect(
      makeStore({ fileOps: crashing }).update({
        export: { filenamePattern: 'lost' },
      }),
    ).rejects.toThrow('crashed');
    expect(tempFiles()).toHaveLength(1);
    expect(readDisk().export.filenamePattern).toBe('safe');

    // The next start reads the intact file and removes the leftover.
    const restarted = makeStore();
    expect((await restarted.load()).export.filenamePattern).toBe('safe');
    expect(restarted.loadOutcome()).toBe('ok');
    expect(tempFiles()).toEqual([]);
  });
});

describe('loading', () => {
  it('uses defaults without writing when there is no file', async () => {
    const store = makeStore();
    expect(await store.load()).toEqual(DEFAULTS);
    expect(store.loadOutcome()).toBe('missing');
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it.each([
    ['cut-off JSON', '{"capture": {"hotkey": '],
    ['a JSON array', '[1, 2, 3]'],
    ['an empty file', ''],
  ])('backs up %s and loads defaults, never silently', async (_label, text) => {
    fs.writeFileSync(filePath, text);
    const store = makeStore({
      now: () => new Date('2026-10-02T12:34:56.789Z'),
    });

    expect(await store.load()).toEqual(DEFAULTS);
    expect(store.loadOutcome()).toBe('recovered');
    const backup = `${filePath}.bak-2026-10-02T12-34-56-789Z`;
    expect(fs.readFileSync(backup, 'utf-8')).toBe(text);
    expect(fs.existsSync(filePath)).toBe(false);
    expect(log.error).toHaveBeenCalledWith(
      expect.stringContaining(`moved it to ${backup}`),
    );
  });

  it('keeps valid fields of a damaged file and defaults the rest', async () => {
    writeDisk({
      editor: { defaultStrokeWidth: 'wide', defaultTextSize: 24 },
      export: { autoSave: true },
    });
    const prefs = await makeStore().load();
    expect(prefs.editor.defaultStrokeWidth).toBe(
      DEFAULTS.editor.defaultStrokeWidth,
    );
    expect(prefs.editor.defaultTextSize).toBe(24);
    expect(prefs.export.autoSave).toBe(true);
  });
});

describe('deep merge', () => {
  it('never drops sibling keys on a partial update', async () => {
    const store = makeStore();
    await store.update({ editor: { defaultStrokeWidth: 7 } });
    await store.update({ pii: { detectors: { ssn: true } } });
    await store.update({
      presentation: { shadow: { blur: 10 } },
    } as unknown as PreferencesUpdate);

    const prefs = readDisk();
    expect(prefs.editor).toEqual({
      ...DEFAULTS.editor,
      defaultStrokeWidth: 7,
    });
    expect(prefs.pii).toEqual({
      ...DEFAULTS.pii,
      detectors: { ...DEFAULTS.pii.detectors, ssn: true },
    });
    expect(prefs.presentation.shadow).toEqual({
      ...DEFAULTS.presentation.shadow,
      blur: 10,
    });
    expect(prefs.capture).toEqual(DEFAULTS.capture);
  });

  it('keeps the current value when an update carries an invalid one', async () => {
    const store = makeStore();
    await store.update({ editor: { defaultStrokeWidth: 12 } });
    await store.update({
      editor: { defaultStrokeWidth: 'wide' },
    } as unknown as PreferencesUpdate);
    expect(readDisk().editor.defaultStrokeWidth).toBe(12);
  });
});

describe('migrations', () => {
  const legacy = (presentation: Record<string, unknown>, exportPrefs = {}) => ({
    ...DEFAULTS,
    export: {
      filenamePattern: 'X-Shot_$TIMESTAMP',
      autoSave: false,
      ...exportPrefs,
    },
    // Old files had no backgroundImage key.
    presentation: {
      ...Object.fromEntries(
        Object.entries(DEFAULTS.presentation).filter(
          ([key]) => key !== 'backgroundImage',
        ),
      ),
      ...presentation,
    },
  });

  it('moves presentation.exportScale into an unset export.defaultScale', async () => {
    writeDisk(legacy({ exportScale: 3, backgroundImageUrl: null }));
    const prefs = await makeStore().load();
    expect(prefs.export.defaultScale).toBe(3);
    expect(prefs.presentation).not.toHaveProperty('exportScale');
    const onDisk = readDisk();
    expect(onDisk.export.defaultScale).toBe(3);
    expect(onDisk.presentation).not.toHaveProperty('exportScale');
    expect(onDisk.presentation).not.toHaveProperty('backgroundImageUrl');
  });

  it('keeps an export.defaultScale that is already set', async () => {
    writeDisk(legacy({ exportScale: 3 }, { defaultScale: 2 }));
    const prefs = await makeStore().load();
    expect(prefs.export.defaultScale).toBe(2);
    expect(readDisk().presentation).not.toHaveProperty('exportScale');
  });

  it('moves a data-URL background into a file', async () => {
    const image = pngBytes(2048);
    writeDisk(
      legacy({
        backgroundImageUrl: `data:image/png;base64,${image.toString('base64')}`,
      }),
    );
    const prefs = await makeStore().load();
    const ref = prefs.presentation.backgroundImage;
    expect(ref?.kind).toBe('file');
    const id = ref?.kind === 'file' ? ref.id : '';
    expect(id).toMatch(/\.png$/);
    expect(fs.readFileSync(path.join(backgroundsDir(), id))).toEqual(image);
    const text = fs.readFileSync(filePath, 'utf-8');
    expect(text).not.toContain('data:');
    expect(text).not.toContain('backgroundImageUrl');
  });

  it('keeps a 5 MB background across a reload', async () => {
    const image = pngBytes(5 * 1024 * 1024);
    writeDisk(
      legacy({
        backgroundImageUrl: `data:image/png;base64,${image.toString('base64')}`,
      }),
    );
    const migrated = await makeStore().load();

    const reloaded = await makeStore().load();
    expect(reloaded.presentation.backgroundImage).toEqual(
      migrated.presentation.backgroundImage,
    );
    const ref = reloaded.presentation.backgroundImage;
    const stored = await createBackgroundStore(backgroundsDir()).read(
      ref?.kind === 'file' ? ref.id : '',
    );
    expect(stored?.contentType).toBe('image/png');
    expect(stored?.bytes.equals(image)).toBe(true);
  });

  it('drops a background that cannot be read, and says so', async () => {
    writeDisk(
      legacy({ backgroundImageUrl: 'data:image/png;base64,bm90IGFuIGltYWdl' }),
    );
    const prefs = await makeStore().load();
    expect(prefs.presentation.backgroundImage).toBeNull();
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('background image dropped'),
    );
  });

  it('keeps a built-in background as its bundle file', async () => {
    writeDisk(legacy({ backgroundImageUrl: './0d52cdb6142e117aeec9.png' }));
    const prefs = await makeStore().load();
    expect(prefs.presentation.backgroundImage).toEqual({
      kind: 'builtin',
      file: '0d52cdb6142e117aeec9.png',
    });
  });

  it('leaves current preferences alone', async () => {
    const current = {
      ...DEFAULTS,
      editor: { ...DEFAULTS.editor, defaultTextSize: 40 },
    };
    writeDisk(current);
    const before = fs.statSync(filePath).mtimeMs;
    const prefs = await makeStore().load();
    expect(prefs).toEqual(current);
    expect(fs.statSync(filePath).mtimeMs).toBe(before);
    expect(log.info).not.toHaveBeenCalled();
  });
});

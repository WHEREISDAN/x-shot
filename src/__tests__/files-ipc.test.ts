/**
 * @jest-environment node
 */
import { clipboard, ipcMain, nativeImage } from 'electron';
import registerFileIpcHandlers from '../main/ipc/files';

jest.mock('electron', () => ({
  app: { getPath: jest.fn(() => '/tmp') },
  clipboard: { writeImage: jest.fn() },
  dialog: { showSaveDialog: jest.fn(), showOpenDialog: jest.fn() },
  ipcMain: { handle: jest.fn() },
  nativeImage: {
    createFromBuffer: jest.fn(() => ({ isEmpty: () => false })),
  },
}));
jest.mock('../main/preferences', () => ({
  loadPreferences: jest.fn(),
  sanitizeFilenamePattern: (pattern: string) => pattern,
}));
jest.mock('../main/logger', () => ({
  getLogger: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

type Handler = (event: unknown, payload: unknown) => Promise<unknown>;

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);

registerFileIpcHandlers();
const handlers = new Map<string, Handler>(
  (ipcMain.handle as jest.Mock).mock.calls,
);

function handlerFor(channel: string): Handler {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler for ${channel}`);
  return handler;
}

describe('copy-image', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the clipboard from PNG bytes', async () => {
    await expect(handlerFor('copy-image')({}, { png: PNG })).resolves.toEqual({
      ok: true,
    });
    const [bytes] = (nativeImage.createFromBuffer as jest.Mock).mock.calls[0];
    expect(Buffer.compare(bytes, Buffer.from(PNG))).toBe(0);
    expect(clipboard.writeImage).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['a data URL', { dataUrl: 'data:image/png;base64,iVBORw0KGgo=' }],
    ['a string', { png: 'iVBORw0KGgo=' }],
    ['bytes that are not a PNG', { png: new Uint8Array([0xff, 0xd8, 0xff]) }],
    ['no payload', undefined],
  ])('refuses %s', async (_label, payload) => {
    await expect(handlerFor('copy-image')({}, payload)).resolves.toEqual({
      ok: false,
      error: 'The image is not PNG data.',
    });
    expect(clipboard.writeImage).not.toHaveBeenCalled();
  });
});

describe('save-image', () => {
  it('refuses anything but PNG bytes before touching the disk', async () => {
    await expect(
      handlerFor('save-image')({}, { dataUrl: 'data:image/png;base64,AAAA' }),
    ).resolves.toEqual({
      status: 'failed',
      error: 'The image is not PNG data.',
    });
  });
});

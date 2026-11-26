/**
 * @jest-environment node
 */
import { desktopCapturer, screen } from 'electron';
import {
  findDisplaySnapshot,
  prepareDisplaySnapshots,
  releaseDisplaySnapshots,
} from '../main/display-snapshots';

jest.mock('electron', () => ({
  desktopCapturer: { getSources: jest.fn() },
  screen: { getAllDisplays: jest.fn() },
}));
jest.mock('electron-log', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../main/capture-diagnostics', () => ({
  markCaptureStage: jest.fn(),
}));

const DISPLAYS = [
  { id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 }, scaleFactor: 2 },
  {
    id: 2,
    bounds: { x: 1440, y: 0, width: 1920, height: 1080 },
    scaleFactor: 1,
  },
];

const image = (width: number, height: number) => ({
  getSize: () => ({ width, height }),
  isEmpty: () => false,
  toPNG: () => Buffer.alloc(0),
});

/**
 * One screen source per display. Like Chromium, each thumbnail keeps its
 * display's aspect ratio inside the requested box.
 */
const stubScreenSources = (displayIdOf: (id: number) => string) => {
  (desktopCapturer.getSources as jest.Mock).mockImplementation(
    async ({ thumbnailSize: box }) =>
      DISPLAYS.map((display) => {
        const width = display.bounds.width * display.scaleFactor;
        const height = display.bounds.height * display.scaleFactor;
        const scale = Math.min(box.width / width, box.height / height);
        return {
          id: `screen:${display.id}:0`,
          display_id: displayIdOf(display.id),
          thumbnail: image(
            Math.round(width * scale),
            Math.round(height * scale),
          ),
        };
      }),
  );
};

beforeEach(() => {
  (screen.getAllDisplays as jest.Mock).mockReturnValue(DISPLAYS);
  stubScreenSources(String);
});

afterEach(() => releaseDisplaySnapshots());

describe('findDisplaySnapshot', () => {
  it('finds a snapshot by display id, as a number or a string', async () => {
    await prepareDisplaySnapshots('session-1');

    expect(findDisplaySnapshot({ displayId: 2 })).toMatchObject({
      displayId: 2,
      width: 1920,
      height: 1080,
      scaleFactor: 1,
    });
    expect(findDisplaySnapshot({ displayId: '1' })).toMatchObject({
      displayId: 1,
      width: 2880,
      height: 1800,
      scaleFactor: 2,
    });
  });

  it('falls back to the source id when the display id does not match', async () => {
    await prepareDisplaySnapshots('session-1');

    expect(
      findDisplaySnapshot({ displayId: '99', sourceId: 'screen:2:0' }),
    ).toMatchObject({ displayId: 2 });
    expect(findDisplaySnapshot({ sourceId: 'screen:1:0' })).toMatchObject({
      displayId: 1,
    });
  });

  it('matches by source id when sources report no display id', async () => {
    stubScreenSources(() => '');
    await prepareDisplaySnapshots('session-1');

    expect(
      findDisplaySnapshot({ displayId: '', sourceId: 'screen:2:0' }),
    ).toMatchObject({ displayId: 2, sourceId: 'screen:2:0' });
  });

  it('prefers the display id over a different source id', async () => {
    await prepareDisplaySnapshots('session-1');

    expect(
      findDisplaySnapshot({ displayId: 1, sourceId: 'screen:2:0' }),
    ).toMatchObject({ displayId: 1 });
  });

  it('finds nothing without a match or once the snapshots are released', async () => {
    await prepareDisplaySnapshots('session-1');
    expect(
      findDisplaySnapshot({ displayId: 99, sourceId: 'screen:99:0' }),
    ).toBeUndefined();
    expect(findDisplaySnapshot({})).toBeUndefined();

    releaseDisplaySnapshots();
    expect(findDisplaySnapshot({ displayId: 1 })).toBeUndefined();
  });

  it('propagates desktopCapturer errors and releases partial snapshots', async () => {
    (desktopCapturer.getSources as jest.Mock)
      .mockImplementationOnce(async () => [
        {
          id: 'screen:1:0',
          display_id: '1',
          thumbnail: image(2880, 1800),
        },
      ])
      .mockRejectedValueOnce(new Error('Failed to get sources'));

    await expect(prepareDisplaySnapshots('session-err')).rejects.toThrow(
      'Failed to get sources',
    );
    expect(findDisplaySnapshot({ displayId: 1 })).toBeUndefined();
    expect(findDisplaySnapshot({ displayId: 2 })).toBeUndefined();
  });
});

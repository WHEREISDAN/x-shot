import domtoimage from 'dom-to-image-more';
import { exportDomToPng } from '../renderer/components/editor/editor-export-dom';

jest.mock('dom-to-image-more', () => ({
  __esModule: true,
  default: {
    toBlob: jest.fn(),
  },
}));

const FAKE_PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

function makeElement(width: number, height: number): HTMLElement {
  const el = document.createElement('div');
  Object.defineProperty(el, 'offsetWidth', { value: width });
  Object.defineProperty(el, 'offsetHeight', { value: height });
  return el;
}

describe('exportDomToPng memory-cap scaling', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (window as unknown as { electron: unknown }).electron = {
      ipcRenderer: { log: jest.fn() },
    };
    (domtoimage.toBlob as jest.Mock).mockResolvedValue({
      arrayBuffer: async () => FAKE_PNG.buffer,
    });
  });

  afterEach(() => {
    delete (window as unknown as { electron?: unknown }).electron;
  });

  it.each([1, 2, 4])(
    'keeps under-budget %ix scale unchanged for 1920x1080',
    async (scale) => {
      const element = makeElement(1920, 1080);
      const png = await exportDomToPng({ element, scale });

      expect(png).toEqual(FAKE_PNG);
      expect(domtoimage.toBlob).toHaveBeenCalledWith(
        element,
        expect.objectContaining({
          width: 1920,
          height: 1080,
          scale,
        }),
      );
    },
  );

  it('clamps >500 MB high-DPI exports using 1x base dimensions instead of shrinking below 1x', async () => {
    // 5120x3072 at 1x = 60 MB; at 4x = 960 MB (> 500 MB); maxScale = sqrt(500 / 60) ~= 2.8868
    const element = makeElement(5120, 3072);
    await exportDomToPng({ element, scale: 4 });

    const [, options] = (domtoimage.toBlob as jest.Mock).mock.calls[0];
    expect(options.scale).toBeCloseTo(Math.sqrt(500 / 60), 4);
    expect(options.scale).toBeGreaterThan(2.8);
    expect(options.scale).toBeLessThan(4);

    const outputMB =
      (5120 * options.scale * (3072 * options.scale) * 4) / (1024 * 1024);
    expect(outputMB).toBeCloseTo(500, 1);
  });

  it('clamps 5120x2880 at 4x to ~2.98x rather than <1x', async () => {
    const element = makeElement(5120, 2880);
    await exportDomToPng({ element, scale: 4 });

    const [, options] = (domtoimage.toBlob as jest.Mock).mock.calls[0];
    expect(options.scale).toBeCloseTo(Math.sqrt(500 / 56.25), 4);
    expect(options.scale).toBeGreaterThan(1);
  });
});

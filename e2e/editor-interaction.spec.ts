import path from 'path';
import { expect, test, type Page } from '@playwright/test';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  type PackagedApp,
  type SeedPreferences,
  type FixtureCapture,
} from './packaged-app';
import {
  editorToolbar,
  selectTool,
  stageShapes,
  stageSvg,
} from './editor-actions';

const FIXTURE: FixtureCapture = {
  fixtureDataUrl: pngDataUrl(path.join(__dirname, 'fixtures', 'ocr-pii.png')),
  width: 1000,
  height: 420,
  sessionId: 'interaction',
};
// The dock is 50 px tall on one row; a wrapped dock would be taller.
const ONE_ROW_MAX_HEIGHT = 60;
const MIN_WINDOW = { width: 960, height: 640 };

type Box = { x: number; y: number; width: number; height: number };

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width &&
  b.x < a.x + a.width &&
  a.y < b.y + b.height &&
  b.y < a.y + a.height;

/** The floating controls that must never cover the fitted capture. */
function editorControls(page: Page) {
  return {
    dock: editorToolbar(page),
    history: page.getByRole('group', { name: 'History and view' }),
    actions: page.getByRole('group', { name: 'Capture actions' }),
    panel: page.getByRole('complementary', { name: 'Presentation panel' }),
  };
}

/** Names of the visible controls that overlap the capture or each other. */
async function coveredBy(page: Page): Promise<string[]> {
  const shot = await editorFor(page, FIXTURE)
    .getByAltText('Screenshot')
    .boundingBox();
  if (!shot) return ['no capture'];
  const boxes = await Promise.all(
    Object.entries(editorControls(page)).map(async ([name, locator]) => ({
      name,
      box: (await locator.count()) ? await locator.boundingBox() : null,
    })),
  );
  const shown = boxes.filter(
    (entry): entry is { name: string; box: Box } => entry.box !== null,
  );
  const overCapture = shown
    .filter(({ box }) => overlaps(shot, box))
    .map(({ name }) => name);
  const dock = shown.find(({ name }) => name === 'dock');
  const overDock = shown
    .filter(
      ({ name, box }) => name !== 'dock' && dock && overlaps(dock.box, box),
    )
    .map(({ name }) => `${name} over dock`);
  return [...overCapture, ...overDock];
}

const CENSOR_OFF: SeedPreferences = {
  system: { launchAtStartup: false, showInTray: false },
  pii: { autoDetect: false },
};

/** With `tool` picked, the dock is one row, usable and clear of the capture. */
async function expectDockClear(page: Page, tool: string) {
  await selectTool(page, tool);
  const toolbar = editorToolbar(page);
  const controls = await toolbar.locator('button, select').all();
  expect(controls.length).toBeGreaterThan(15);
  await Promise.all(
    controls.map(async (control) => {
      await expect(control).toBeInViewport({ ratio: 1 });
      await control.click({ trial: true });
    }),
  );
  const box = await toolbar.boundingBox();
  expect(box?.height).toBeLessThanOrEqual(ONE_ROW_MAX_HEIGHT);
  await expect.poll(() => coveredBy(page)).toEqual([]);
}

test.describe('editor interaction', () => {
  let packaged: PackagedApp | undefined;

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
  });

  test('at the minimum window size the dock is one row and nothing covers the capture', async () => {
    packaged = await launchPackagedApp(CENSOR_OFF);
    const minimum = await packaged.app.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find(
        (win) => !win.webContents.getURL().includes('#/'),
      );
      // Smaller than allowed: the window stops at its minimum size.
      main?.setSize(800, 500);
      return main?.getMinimumSize();
    });
    expect(minimum).toEqual([MIN_WINDOW.width, MIN_WINDOW.height]);
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    await expect
      .poll(() =>
        page.evaluate(() => ({
          width: window.innerWidth,
          height: window.innerHeight,
        })),
      )
      .toEqual(MIN_WINDOW);

    // Stroke only, then Text adds its size and Text Highlight its level.
    await ['Rect', 'Text', 'Text Highlight'].reduce(
      (previous, tool) => previous.then(() => expectDockClear(page, tool)),
      Promise.resolve(),
    );
  });

  test('hiding the Presentation panel gives the stage the full width', async () => {
    packaged = await launchPackagedApp(CENSOR_OFF);
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    const { panel } = editorControls(page);
    const shot = editorFor(page, FIXTURE).getByAltText('Screenshot');
    const widthWithPanel = (await shot.boundingBox())?.width ?? 0;

    await page
      .getByRole('button', { name: 'Hide Presentation panel', exact: true })
      .click();
    await expect(panel).toHaveCount(0);
    await expect
      .poll(async () => (await shot.boundingBox())?.width ?? 0)
      .toBeGreaterThan(widthWithPanel);
    await expect.poll(() => coveredBy(page)).toEqual([]);

    await page
      .getByRole('button', { name: 'Show Presentation panel', exact: true })
      .click();
    await expect(panel).toBeVisible();
    await expect
      .poll(async () => (await shot.boundingBox())?.width ?? 0)
      .toBeCloseTo(widthWithPanel, 0);
  });

  test('a drag released over the side panel commits the shape', async () => {
    packaged = await launchPackagedApp(CENSOR_OFF);
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    await selectTool(page, 'Rect');

    const stage = await stageSvg(page, FIXTURE).boundingBox();
    const panel = await page
      .getByText('Presentation', { exact: true })
      .boundingBox();
    if (!stage || !panel) throw new Error('Stage or side panel not visible');
    await page.mouse.move(
      stage.x + stage.width * 0.3,
      stage.y + stage.height * 0.3,
    );
    await page.mouse.down();
    await page.mouse.move(panel.x + panel.width / 2, panel.y + 120, {
      steps: 10,
    });
    await page.mouse.up();

    const rects = stageShapes(page, FIXTURE, 'rect');
    await expect(rects).toHaveCount(1);
    // Moving the pointer afterwards must not keep resizing the rect.
    const width = await rects.locator('rect').getAttribute('width');
    await page.mouse.move(stage.x + 20, stage.y + 20, { steps: 5 });
    expect(await rects.locator('rect').getAttribute('width')).toBe(width);
  });

  test('double-click edits a text in plain mode', async () => {
    packaged = await launchPackagedApp({
      ...CENSOR_OFF,
      presentation: { padding: 0, inset: 0 },
    });
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    await expect(
      editorFor(page, FIXTURE).locator('[data-stage-mode="plain"]'),
    ).toHaveCount(1);

    await selectTool(page, 'Text');
    const stage = await stageSvg(page, FIXTURE).boundingBox();
    if (!stage) throw new Error('Editor stage is not visible');
    await page.mouse.click(
      stage.x + stage.width * 0.55,
      stage.y + stage.height * 0.85,
    );
    const input = page.getByRole('textbox', { name: 'Edit text' });
    await input.fill('Hello');
    await input.press('Enter');
    const text = stageSvg(page, FIXTURE).locator('text');
    await expect(text).toHaveText('Hello');

    await selectTool(page, 'Select');
    // The text group's hit area receives the double-click, not the glyphs.
    await stageShapes(page, FIXTURE, 'text').dblclick();
    await expect(input).toHaveValue('Hello');
    // The edit box opens on the text: its first line sits where the stage
    // draws the glyphs, inside the 1 px border and the 2 x 5 px padding.
    const glyphs = await text.boundingBox();
    const box = await input.boundingBox();
    if (!glyphs || !box) throw new Error('Text or edit box not visible');
    expect(Math.abs(box.x + 6 - glyphs.x)).toBeLessThanOrEqual(1.5);
    expect(Math.abs(box.y + 3 - glyphs.y)).toBeLessThanOrEqual(1.5);
    await input.fill('Hello world');
    await input.press('Enter');
    await expect(text).toHaveText('Hello world');
  });
});

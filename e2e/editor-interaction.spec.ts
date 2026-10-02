import path from 'path';
import { expect, test } from '@playwright/test';
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
// One toolbar row is about 60 px tall; a wrapped toolbar is taller.
const ONE_ROW_MAX_HEIGHT = 70;

const CENSOR_OFF: SeedPreferences = {
  system: { launchAtStartup: false, showInTray: false },
  pii: { autoDetect: false },
};

test.describe('editor interaction', () => {
  let packaged: PackagedApp | undefined;

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
  });

  test('every toolbar button is visible and clickable at 1024x700', async () => {
    packaged = await launchPackagedApp(CENSOR_OFF);
    await packaged.app.evaluate(({ BrowserWindow }) => {
      const main = BrowserWindow.getAllWindows().find(
        (win) => !win.webContents.getURL().includes('#/'),
      );
      main?.setSize(1024, 700);
    });
    const page = packaged.window;
    await deliverScreenshot(packaged, FIXTURE);
    await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(1024);

    const toolbar = editorToolbar(page);
    const buttons = await toolbar.getByRole('button').all();
    expect(buttons.length).toBeGreaterThan(9);
    await Promise.all(
      buttons.map(async (button) => {
        await expect(button).toBeInViewport({ ratio: 1 });
        await button.click({ trial: true });
      }),
    );
    const box = await toolbar.boundingBox();
    expect(box?.height).toBeGreaterThan(ONE_ROW_MAX_HEIGHT);
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
    await input.fill('Hello world');
    await input.press('Enter');
    await expect(text).toHaveText('Hello world');
  });
});

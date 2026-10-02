import path from 'path';
import { expect, test } from '@playwright/test';
import type { PiiDetectors } from '../src/shared/ipc-types';
import {
  deliverScreenshot,
  editorFor,
  launchPackagedApp,
  pngDataUrl,
  meanBrightness,
  readPiiMasks,
  recordCopies,
  recordedCopies,
  waitForPiiMasks,
  type PackagedApp,
  type SeedPreferences,
  type FixtureCapture,
} from './packaged-app';
import {
  UNDO,
  drawEllipse,
  selectTool,
  stageEllipses,
  stageSvg,
} from './editor-actions';

const FIXTURES = path.join(__dirname, 'fixtures');
// ocr-pii.png holds an email, a phone number and an IPv4 address.
const FIXTURE_A_MASKS = 3;
// ocr-pii-b.png holds one email, starting at x=420 on the y=300 line.
const FIXTURE_B_EMAIL_MIN = { x: 400, y: 250 };
// Inside the email text of ocr-pii.png, and the PII-free first line.
const EMAIL_REGION = { x: 165, y: 130, width: 300, height: 20 };
const PLAIN_TEXT_REGION = { x: 40, y: 45, width: 400, height: 30 };

const DETECTORS: PiiDetectors = {
  email: true,
  phone: true,
  address: false,
  ipv4: true,
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
};

const CENSOR_ON: SeedPreferences = {
  system: { launchAtStartup: false, showInTray: false },
  pii: { autoDetect: true, defaultStyle: 'blur', detectors: DETECTORS },
};

function fixtureCapture(file: string, sessionId: string): FixtureCapture {
  return {
    fixtureDataUrl: pngDataUrl(path.join(FIXTURES, file)),
    width: 1000,
    height: 420,
    sessionId,
  };
}

test.describe('PII mask layer', () => {
  let packaged: PackagedApp | undefined;

  test.afterEach(async () => {
    await packaged?.close();
    packaged = undefined;
  });

  test('masks only the newer of two back-to-back captures', async () => {
    packaged = await launchPackagedApp(CENSOR_ON);
    const page = packaged.window;
    const imageA = fixtureCapture('ocr-pii.png', 'race-a');
    const imageB = fixtureCapture('ocr-pii-b.png', 'race-b');

    await deliverScreenshot(packaged, imageA);
    await deliverScreenshot(packaged, imageB);
    const editorB = editorFor(page, imageB);
    await waitForPiiMasks(packaged, editorB, 1);
    // Give image A's OCR time to finish; its result must never reach B.
    await page.waitForTimeout(3_000);

    await expect(editorFor(page, imageA)).toHaveCount(0);
    const masks = await readPiiMasks(editorB);
    expect(masks).toHaveLength(1);
    expect(masks[0].tag).toBe('pii-email');
    expect(masks[0].x).toBeGreaterThan(FIXTURE_B_EMAIL_MIN.x);
    expect(masks[0].y).toBeGreaterThan(FIXTURE_B_EMAIL_MIN.y);
  });

  test('undoing annotations never removes PII masks', async () => {
    packaged = await launchPackagedApp(CENSOR_ON);
    const page = packaged.window;
    const image = fixtureCapture('ocr-pii.png', 'undo-a');
    await deliverScreenshot(packaged, image);
    const editor = editorFor(page, image);
    await waitForPiiMasks(packaged, editor, FIXTURE_A_MASKS);

    await drawEllipse(page, image);
    await expect(stageEllipses(page, image)).toHaveCount(1);
    await page.keyboard.press(UNDO);
    await expect(stageEllipses(page, image)).toHaveCount(0);
    // The history is now empty; another undo must not touch the masks.
    await page.keyboard.press(UNDO);
    await page.waitForTimeout(300);

    expect(await readPiiMasks(editor)).toHaveLength(FIXTURE_A_MASKS);
  });

  test('masks are edited in the editor and deletions stick', async () => {
    packaged = await launchPackagedApp(CENSOR_ON);
    const page = packaged.window;
    const image = fixtureCapture('ocr-pii.png', 'edit-a');
    await deliverScreenshot(packaged, image);
    const editor = editorFor(page, image);
    await waitForPiiMasks(packaged, editor, FIXTURE_A_MASKS);

    // With Censor PII on, the Rect tool draws a manual mask. Stay left of
    // the presentation panel, which overlaps the right edge of the stage.
    await selectTool(page, 'Rect');
    const stage = await stageSvg(page, image).boundingBox();
    if (!stage) throw new Error('Editor stage is not visible');
    await page.mouse.move(
      stage.x + stage.width * 0.05,
      stage.y + stage.height * 0.8,
    );
    await page.mouse.down();
    await page.mouse.move(
      stage.x + stage.width * 0.2,
      stage.y + stage.height * 0.95,
      { steps: 5 },
    );
    await page.mouse.up();
    await expect(editor.locator('[data-pii-tag="pii-manual"]')).toHaveCount(1);

    await selectTool(page, 'Select');
    const email = await editor
      .locator('[data-pii-tag="pii-email"]')
      .boundingBox();
    if (!email) throw new Error('Email mask is not visible');
    await page.mouse.click(
      email.x + email.width / 2,
      email.y + email.height / 2,
    );
    await page.keyboard.press('Delete');
    await expect(editor.locator('[data-pii-tag="pii-email"]')).toHaveCount(0);

    // Mask edits live outside the undo history.
    await page.keyboard.press(UNDO);
    await page.waitForTimeout(300);
    const tags = (await readPiiMasks(editor)).map((mask) => mask.tag).sort();
    expect(tags).toEqual(['pii-ipv4', 'pii-manual', 'pii-phone']);
  });

  test('auto-copy with Censor PII on copies only the redacted export', async () => {
    packaged = await launchPackagedApp({
      ...CENSOR_ON,
      capture: { autoCopyToClipboard: true },
      // Plain export keeps copied pixels aligned with the capture.
      presentation: { padding: 0, inset: 0 },
    });
    await recordCopies(packaged);
    const image = fixtureCapture('ocr-pii.png', 'copy-a');
    await deliverScreenshot(packaged, image);

    const current = packaged;
    await expect
      .poll(async () => (await recordedCopies(current)).length, {
        timeout: 120_000,
      })
      .toBeGreaterThan(0);
    await packaged.window.waitForTimeout(1_000);
    const copies = await recordedCopies(packaged);
    expect(copies).toHaveLength(1);
    expect(copies[0]).not.toBe(image.fixtureDataUrl);

    const brightness = async (dataUrl: string, region: typeof EMAIL_REGION) =>
      meanBrightness(current, dataUrl, region, image.width);
    const rawEmail = await brightness(image.fixtureDataUrl, EMAIL_REGION);
    const copiedEmail = await brightness(copies[0], EMAIL_REGION);
    const rawText = await brightness(image.fixtureDataUrl, PLAIN_TEXT_REGION);
    const copiedText = await brightness(copies[0], PLAIN_TEXT_REGION);

    // The raw email is dark text on white; the copy covers it in black.
    expect(rawEmail).toBeGreaterThan(120);
    expect(copiedEmail).toBeLessThan(40);
    // Text without PII is copied unchanged.
    expect(Math.abs(copiedText - rawText)).toBeLessThan(25);
  });
});

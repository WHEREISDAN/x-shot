import type { Page } from '@playwright/test';
import type { ScreenshotResult } from '../src/shared/ipc-types';
import { editorFor } from './packaged-app';

export const UNDO = 'ControlOrMeta+Z';
export const REDO = 'ControlOrMeta+Shift+Z';

export function stageSvg(page: Page, screenshot: ScreenshotResult) {
  return editorFor(page, screenshot).locator(
    `svg[viewBox="0 0 ${screenshot.width} ${screenshot.height}"]`,
  );
}

export function stageEllipses(page: Page, screenshot: ScreenshotResult) {
  return stageSvg(page, screenshot).locator('ellipse');
}

/**
 * Picks a toolbar tool. Uses a DOM click because on narrow windows the
 * centered toolbar overflows and its outer buttons sit off-screen.
 */
export async function selectTool(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).dispatchEvent('click');
}

/** Draws an ellipse across the middle of the stage with the Ellipse tool. */
export async function drawEllipse(page: Page, screenshot: ScreenshotResult) {
  await selectTool(page, 'Ellipse');
  const box = await stageSvg(page, screenshot).boundingBox();
  if (!box) throw new Error('Editor stage is not visible');
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.6, {
    steps: 8,
  });
  await page.mouse.up();
}

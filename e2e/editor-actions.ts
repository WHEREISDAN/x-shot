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

/** Committed shapes of one type; a shape still being drawn is excluded. */
export function stageShapes(
  page: Page,
  screenshot: ScreenshotResult,
  type: string,
) {
  return stageSvg(page, screenshot).locator(`[data-shape-type="${type}"]`);
}

export function stageEllipses(page: Page, screenshot: ScreenshotResult) {
  return stageShapes(page, screenshot, 'ellipse');
}

export function editorToolbar(page: Page) {
  return page.getByRole('toolbar', { name: 'Editor tools' });
}

/** Picks a tool with a real click on the bottom toolbar. */
export async function selectTool(page: Page, name: string) {
  await editorToolbar(page).getByRole('button', { name, exact: true }).click();
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

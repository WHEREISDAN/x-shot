import { loadPreferences } from './preferences';
import { startRecapture } from './capture-coordinator';

/**
 * Re-runs the last saved area selection through the capture coordinator.
 * Resolves false when nothing has been captured yet or a session is busy.
 */
export async function recaptureLastSelection(): Promise<boolean> {
  const { capture } = await loadPreferences();
  const last = capture.lastSelection;
  if (!last) return false;
  return startRecapture({
    x: last.x,
    y: last.y,
    width: last.width,
    height: last.height,
  });
}

export default recaptureLastSelection;

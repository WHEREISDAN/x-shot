import fs from 'fs';
import os from 'os';
import path from 'path';

/**
 * Gives the run one folder for its throwaway app profiles and removes it
 * when the run ends. A launch that fails can end its test before the test
 * could clean up, so the profile is removed here instead.
 */
export default function globalSetup(): () => void {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'xshot-e2e-'));
  process.env.XSHOT_E2E_TMP = dir;
  return () => fs.rmSync(dir, { recursive: true, force: true });
}

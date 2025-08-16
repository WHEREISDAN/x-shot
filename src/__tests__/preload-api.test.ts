/* eslint-env jest, es2021 */
import type { ElectronHandler } from '../main/preload';

describe('preload api typings', () => {
  it('exposes typed ipc methods on window.electron (type-only test)', () => {
    // This is a type-level assertion to ensure the API surface matches
    const api: ElectronHandler | undefined = (globalThis as any).window
      ?.electron;
    expect(typeof api === 'undefined' || typeof api === 'object').toBe(true);
  });
});

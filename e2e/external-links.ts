import type { PackagedApp } from './packaged-app';

/** Makes main record external links instead of opening a browser. */
export async function recordOpenedUrls({ app }: PackagedApp): Promise<void> {
  await app.evaluate(({ shell }) => {
    const store = global as unknown as { xshotOpened: string[] };
    store.xshotOpened = [];
    Object.assign(shell, {
      openExternal: async (url: string) => {
        store.xshotOpened.push(url);
      },
    });
  });
}

export async function openedUrls({ app }: PackagedApp): Promise<string[]> {
  return app.evaluate(
    () => (global as unknown as { xshotOpened: string[] }).xshotOpened,
  );
}

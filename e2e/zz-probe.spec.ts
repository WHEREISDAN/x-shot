import { test } from '@playwright/test';
import { launchPackagedApp } from './packaged-app';

// Temporary probe: how desktopCapturer sizes window thumbnails here.
test('probe window thumbnail sizing', async () => {
  const packaged = await launchPackagedApp({
    system: { launchAtStartup: false, showInTray: false },
  });
  const result = await packaged.app.evaluate(
    async ({ BrowserWindow, desktopCapturer, screen }) => {
      const out: Record<string, unknown> = {
        platform: process.platform,
        displays: screen
          .getAllDisplays()
          .map((d) => ({ id: d.id, bounds: d.bounds, scale: d.scaleFactor })),
      };
      const probe = new BrowserWindow({
        width: 640,
        height: 480,
        useContentSize: true,
        title: 'xshot-probe-window',
        backgroundColor: '#ff0000',
        show: true,
      });
      await probe.loadURL(
        'data:text/html,<title>xshot-probe-window</title><body style="background:red;margin:0">probe</body>',
      );
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });
      out.bounds = probe.getBounds();
      out.contentBounds = probe.getContentBounds();
      out.mediaSourceId = probe.getMediaSourceId();
      const sizes: Record<string, unknown> = {};
      await [4096, 1000, 100].reduce(async (prev, box) => {
        await prev;
        try {
          const sources = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: box, height: box },
          });
          const mine = sources.find((s) => s.name === 'xshot-probe-window');
          sizes[`box${box}`] = mine
            ? { id: mine.id, size: mine.thumbnail.getSize() }
            : { names: sources.map((s) => s.name) };
        } catch (error) {
          sizes[`box${box}`] = String(error);
        }
      }, Promise.resolve());
      out.sizes = sizes;
      const sources = await desktopCapturer
        .getSources({
          types: ['window'],
          thumbnailSize: { width: 0, height: 0 },
        })
        .catch(() => []);
      const mine = sources.find((s) => s.name === 'xshot-probe-window');
      const editor = BrowserWindow.getAllWindows().find(
        (w) => w !== probe && !w.webContents.getURL().includes('#/'),
      );
      if (mine && editor) {
        out.measured = await editor.webContents
          .executeJavaScript(
            `(async () => {
              const stream = await navigator.mediaDevices.getUserMedia({
                audio: false,
                video: { mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: ${JSON.stringify(mine.id)}, maxWidth: 8192, maxHeight: 8192 } },
              });
              const track = stream.getVideoTracks()[0];
              const settings = track.getSettings();
              const video = document.createElement('video');
              video.muted = true;
              video.srcObject = stream;
              await new Promise((resolve, reject) => { video.onloadedmetadata = resolve; setTimeout(() => reject(new Error('no metadata')), 3000); });
              const result = { settings: { width: settings.width, height: settings.height }, video: { width: video.videoWidth, height: video.videoHeight } };
              stream.getTracks().forEach((t) => t.stop());
              return result;
            })()`,
            true,
          )
          .catch((error: unknown) => String(error));
      }
      probe.destroy();
      return out;
    },
  );
  // eslint-disable-next-line no-console
  console.log(`PROBE ${JSON.stringify(result)}`);
  await packaged.close();
});

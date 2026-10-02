// Packages an unsigned directory build for the host platform and arch.
// The e2e smoke tests launch this build; run `npm run build` first.
import { Arch, Platform, build } from 'electron-builder';
import webpackPaths from '../configs/webpack.paths';

const arch = Arch[process.arch as keyof typeof Arch];
if (arch === undefined) {
  throw new Error(`Unsupported architecture for packaging: ${process.arch}`);
}

build({
  targets: Platform.current().createTarget('dir', arch),
  publish: 'never',
  config: {
    directories: { output: webpackPaths.smokeBuildPath },
    mac: { identity: null },
  },
}).catch((error: unknown) => {
  process.exitCode = 1;
  throw error;
});

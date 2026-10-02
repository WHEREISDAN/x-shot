/**
 * Fails when a packaged app ships source maps or node_modules, or its
 * app.asar grows past the size limit. Webpack bundles everything the app
 * runs, so only dist/ belongs in the archive. Run after a packaging step.
 */
import fs from 'fs';
import path from 'path';
import { listPackage } from '@electron/asar';
import webpackPaths from '../configs/webpack.paths';

// The bundled backgrounds alone are about 31 MB.
const MAX_ASAR_MB = 50;

export interface AsarReport {
  file: string;
  sizeMb: number;
  entries: number;
  problems: string[];
}

function findAsars(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isFile() && entry.name === 'app.asar') return [full];
    return entry.isDirectory() ? findAsars(full) : [];
  });
}

/** What is wrong with an archive, given its size and entries. */
export function asarProblems(sizeBytes: number, entries: string[]): string[] {
  const normalized = entries.map((entry) => entry.replace(/\\/g, '/'));
  const maps = normalized.filter((entry) => entry.endsWith('.map'));
  const modules = normalized.filter((entry) =>
    /(^|\/)node_modules(\/|$)/.test(entry),
  );
  const sizeMb = sizeBytes / 1024 / 1024;
  return [
    ...(sizeMb > MAX_ASAR_MB
      ? [`is ${sizeMb.toFixed(1)} MB, over the ${MAX_ASAR_MB} MB limit`]
      : []),
    ...(maps.length > 0
      ? [`ships ${maps.length} source maps, e.g. ${maps[0]}`]
      : []),
    ...(modules.length > 0
      ? [`ships node_modules (${modules.length} entries), e.g. ${modules[0]}`]
      : []),
  ];
}

function check(root: string): number {
  const files = findAsars(root);
  if (files.length === 0) {
    console.error(`No app.asar found under ${root}. Package the app first.`);
    return 1;
  }
  const reports: AsarReport[] = files.map((file) => {
    const { size } = fs.statSync(file);
    const entries = listPackage(file, { isPack: false });
    return {
      file: path.relative(webpackPaths.rootPath, file),
      sizeMb: size / 1024 / 1024,
      entries: entries.length,
      problems: asarProblems(size, entries),
    };
  });
  reports.forEach(({ file, sizeMb, entries, problems }) => {
    const status = problems.length === 0 ? 'ok' : problems.join('; ');
    console.log(
      `${file}: ${sizeMb.toFixed(1)} MB, ${entries} entries: ${status}`,
    );
  });
  return reports.some((report) => report.problems.length > 0) ? 1 : 0;
}

if (require.main === module) {
  process.exitCode = check(process.argv[2] ?? webpackPaths.smokeBuildPath);
}

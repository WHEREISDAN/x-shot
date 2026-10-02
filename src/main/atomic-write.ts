import { promises as fs } from 'fs';
import path from 'path';

/** The file operations an atomic write needs; tests replace them. */
export interface AtomicFileOps {
  writeAndSync: (filePath: string, data: string | Uint8Array) => Promise<void>;
  rename: (from: string, to: string) => Promise<void>;
  remove: (filePath: string) => Promise<void>;
}

async function writeAndSync(
  filePath: string,
  data: string | Uint8Array,
): Promise<void> {
  const handle = await fs.open(filePath, 'w');
  try {
    await handle.writeFile(data);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

export const nodeFileOps: AtomicFileOps = {
  writeAndSync,
  rename: (from, to) => fs.rename(from, to),
  remove: (filePath) => fs.rm(filePath, { force: true }),
};

const TEMP_SUFFIX = '.tmp';
// Windows briefly locks files that antivirus or indexers are reading.
const RENAME_ATTEMPTS = 5;
const RENAME_RETRY_MS = 40;
const RETRYABLE = new Set(['EPERM', 'EACCES', 'EBUSY']);

let tempCounter = 0;

function tempPathFor(filePath: string): string {
  tempCounter += 1;
  return `${filePath}.${process.pid}.${Date.now()}.${tempCounter}${TEMP_SUFFIX}`;
}

async function renameWithRetry(
  ops: AtomicFileOps,
  from: string,
  to: string,
  attempt = 1,
): Promise<void> {
  try {
    await ops.rename(from, to);
  } catch (error) {
    const code = (error as { code?: string }).code ?? '';
    if (attempt >= RENAME_ATTEMPTS || !RETRYABLE.has(code)) throw error;
    await new Promise((resolve) => {
      setTimeout(resolve, RENAME_RETRY_MS * attempt);
    });
    await renameWithRetry(ops, from, to, attempt + 1);
  }
}

/**
 * Replaces `filePath` with `data` so that readers only ever see the old or
 * the new contents: the data goes to a temp file in the same folder, is
 * flushed to disk, then renamed over the target.
 */
export async function writeFileAtomic(
  filePath: string,
  data: string | Uint8Array,
  ops: AtomicFileOps = nodeFileOps,
): Promise<void> {
  const tempPath = tempPathFor(filePath);
  try {
    await ops.writeAndSync(tempPath, data);
    await renameWithRetry(ops, tempPath, filePath);
  } catch (error) {
    await ops.remove(tempPath).catch(() => {});
    throw error;
  }
}

/** Removes temp files a crashed write of `filePath` left behind. */
export async function removeStaleTempFiles(filePath: string): Promise<void> {
  const dir = path.dirname(filePath);
  const prefix = `${path.basename(filePath)}.`;
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && name.endsWith(TEMP_SUFFIX))
      .map((name) => fs.rm(path.join(dir, name), { force: true })),
  );
}

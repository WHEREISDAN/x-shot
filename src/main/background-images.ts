import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';
import type { BackgroundImageRef } from '../shared/preferences-types';
import { isBackgroundId } from '../shared/capture-asset';
import { writeFileAtomic } from './atomic-write';

export const MAX_BACKGROUND_BYTES = 32 * 1024 * 1024;

export type BackgroundExtension = 'png' | 'jpg' | 'gif' | 'webp';

export const BACKGROUND_CONTENT_TYPES: Record<BackgroundExtension, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
};

const startsWith = (bytes: Uint8Array, signature: number[], offset = 0) =>
  bytes.length >= offset + signature.length &&
  signature.every((byte, i) => bytes[offset + i] === byte);

/** The image type the bytes start with, or null for anything else. */
export function imageExtension(bytes: Uint8Array): BackgroundExtension | null {
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'jpg';
  if (startsWith(bytes, [0x47, 0x49, 0x46, 0x38])) return 'gif';
  if (
    startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) &&
    startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8)
  ) {
    return 'webp';
  }
  return null;
}

export interface BackgroundStore {
  dir: string;
  /** Stores image bytes under a new id; throws if they are not an image. */
  save: (bytes: Uint8Array) => Promise<BackgroundImageRef>;
  /** The bytes and type of a stored image, or null if there is none. */
  read: (id: string) => Promise<{ bytes: Buffer; contentType: string } | null>;
  /** Deletes every stored image except the given ids. */
  removeExcept: (keep: string[]) => Promise<void>;
}

/** User background images, one file each, named by a random id. */
export function createBackgroundStore(
  dir: string,
  newId: () => string = randomUUID,
): BackgroundStore {
  return {
    dir,
    save: async (bytes) => {
      if (bytes.length > MAX_BACKGROUND_BYTES) {
        throw new Error('The image is larger than 32 MB.');
      }
      const extension = imageExtension(bytes);
      if (!extension) {
        throw new Error('The file is not a PNG, JPEG, GIF or WebP image.');
      }
      const id = `${newId()}.${extension}`;
      await fs.mkdir(dir, { recursive: true });
      await writeFileAtomic(path.join(dir, id), bytes);
      return { kind: 'file', id };
    },
    read: async (id) => {
      if (!isBackgroundId(id)) return null;
      const bytes = await fs.readFile(path.join(dir, id)).catch(() => null);
      const extension = bytes && imageExtension(bytes);
      if (!bytes || !extension) return null;
      return { bytes, contentType: BACKGROUND_CONTENT_TYPES[extension] };
    },
    removeExcept: async (keep) => {
      const entries = await fs.readdir(dir).catch(() => [] as string[]);
      await Promise.all(
        entries
          .filter((name) => isBackgroundId(name) && !keep.includes(name))
          .map((name) => fs.rm(path.join(dir, name), { force: true })),
      );
    },
  };
}

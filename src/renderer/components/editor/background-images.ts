import type { BackgroundImageRef } from '../../../shared/ipc-types';
import { backgroundAssetUrl } from '../../../shared/capture-asset';
import bg1 from '../../../../assets/backgrounds/1.png';
import bg2 from '../../../../assets/backgrounds/2.png';
import bg3 from '../../../../assets/backgrounds/3.png';
import bg4 from '../../../../assets/backgrounds/4.png';
import bg5 from '../../../../assets/backgrounds/5.png';
import bg6 from '../../../../assets/backgrounds/6.png';
import bg7 from '../../../../assets/backgrounds/7.png';
import bg8 from '../../../../assets/backgrounds/8.png';

/** Backgrounds bundled with the app, as URLs of their bundle files. */
export const BUILTIN_BACKGROUNDS = [bg1, bg2, bg3, bg4, bg5, bg6, bg7, bg8];

const fileName = (url: string) => url.split(/[?#]/)[0].split('/').pop() ?? '';

/** Preferences name a bundled background by its bundle file. */
export function builtinBackgroundRef(src: string): BackgroundImageRef {
  return { kind: 'builtin', file: fileName(src) };
}

/** The URL to draw a background from, or null if it is unknown. */
export function backgroundImageSrc(
  image: BackgroundImageRef | null | undefined,
): string | null {
  if (!image) return null;
  if (image.kind === 'file') return backgroundAssetUrl(image.id);
  return (
    BUILTIN_BACKGROUNDS.find((src) => fileName(src) === image.file) ?? null
  );
}

import type { BackgroundImageRef } from '../../../shared/ipc-types';
import type { BuiltinBackgroundId } from '../../../shared/builtin-backgrounds';
import { backgroundAssetUrl } from '../../../shared/capture-asset';
import bg1 from '../../../../assets/backgrounds/1.png';
import bg2 from '../../../../assets/backgrounds/2.png';
import bg3 from '../../../../assets/backgrounds/3.png';
import bg4 from '../../../../assets/backgrounds/4.png';
import bg5 from '../../../../assets/backgrounds/5.png';
import bg6 from '../../../../assets/backgrounds/6.png';
import bg7 from '../../../../assets/backgrounds/7.png';
import bg8 from '../../../../assets/backgrounds/8.png';

export interface BuiltinBackground {
  id: BuiltinBackgroundId;
  src: string;
}

/** Backgrounds bundled with the app, by their stable id. */
export const BUILTIN_BACKGROUNDS: readonly BuiltinBackground[] = [
  { id: '1', src: bg1 },
  { id: '2', src: bg2 },
  { id: '3', src: bg3 },
  { id: '4', src: bg4 },
  { id: '5', src: bg5 },
  { id: '6', src: bg6 },
  { id: '7', src: bg7 },
  { id: '8', src: bg8 },
];

export const builtinBackgroundRef = (
  id: BuiltinBackgroundId,
): BackgroundImageRef => ({ kind: 'builtin', id });

/** The URL to draw a background from, or null if it is unknown. */
export function backgroundImageSrc(
  image: BackgroundImageRef | null | undefined,
): string | null {
  if (!image) return null;
  if (image.kind === 'file') return backgroundAssetUrl(image.id);
  return BUILTIN_BACKGROUNDS.find(({ id }) => id === image.id)?.src ?? null;
}

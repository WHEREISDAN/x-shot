/**
 * Ids of the backgrounds bundled with the app, named after their source
 * files in assets/backgrounds. Preferences store these ids, so they must
 * never change even if an image's contents do.
 */
export const BUILTIN_BACKGROUND_IDS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
] as const;

export type BuiltinBackgroundId = (typeof BUILTIN_BACKGROUND_IDS)[number];

export function isBuiltinBackgroundId(
  value: unknown,
): value is BuiltinBackgroundId {
  return (BUILTIN_BACKGROUND_IDS as readonly unknown[]).includes(value);
}

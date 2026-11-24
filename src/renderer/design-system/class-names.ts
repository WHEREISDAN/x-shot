/** Joins the truthy class names. */
export default function cx(
  ...names: Array<string | false | null | undefined>
): string {
  return names.filter(Boolean).join(' ');
}

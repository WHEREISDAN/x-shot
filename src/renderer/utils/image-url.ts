/** Reads an image URL, such as a capture asset, as bytes. */
export default async function fetchImageBytes(
  url: string,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Couldn't read the capture (HTTP ${response.status})`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

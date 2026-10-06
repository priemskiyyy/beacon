/** The size of a text in UTF-8 bytes, counted without `TextEncoder`, which React Native may lack. */
export const measureBytes = (text: string): number => {
  let bytes = 0;

  for (const character of text) {
    // Two code units are one code point above the basic plane.
    if (character.length === 2) {
      bytes += 4;

      continue;
    }

    const code = character.charCodeAt(0);

    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else {
      bytes += 3;
    }
  }

  return bytes;
};

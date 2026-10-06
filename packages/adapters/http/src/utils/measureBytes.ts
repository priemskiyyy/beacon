/** The size of a text in UTF-8 bytes, counted without `TextEncoder`, which React Native may lack. */
export const measureBytes = (text: string): number => {
  let bytes = 0;

  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;

    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (code < 0x10000) {
      bytes += 3;
    } else {
      bytes += 4;
    }
  }

  return bytes;
};

/**
 * A 64-bit fingerprint of a text, as sixteen hexadecimal digits. It only tells
 * a renewal of a decision from a conflicting one: it is a change detector,
 * never a signature, and it proves nothing about who wrote the text.
 */
export const fingerprint = (text: string): string => {
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;

  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);

    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }

  first =
    Math.imul(first ^ (first >>> 16), 2246822507) ^
    Math.imul(second ^ (second >>> 13), 3266489909);
  second =
    Math.imul(second ^ (second >>> 16), 2246822507) ^
    Math.imul(first ^ (first >>> 13), 3266489909);

  return [first, second]
    .map((half) => (half >>> 0).toString(16).padStart(8, "0"))
    .join("");
};

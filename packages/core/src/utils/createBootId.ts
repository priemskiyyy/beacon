const BYTES = 16;

type RandomSource = {
  randomUUID?: () => string;
  getRandomValues?: (bytes: Uint8Array) => unknown;
};

// The version 4 layout: the version in the high bits of byte 6, the variant in those of byte 8.
const formatVersion4 = (bytes: number[]) => {
  const hex = bytes
    .map((byte, index) => {
      if (index === 6) {
        return (byte & 0x0f) | 0x40;
      }

      if (index === 8) {
        return (byte & 0x3f) | 0x80;
      }

      return byte;
    })
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join("-");
};

/**
 * A new id for this boot, a version 4 UUID of 36 characters: `crypto.randomUUID()`
 * where the host has it, else `crypto.getRandomValues`, else `Math.random`, which
 * is how it works on Hermes without a polyfill. It never throws and never reads
 * the clock. Uniqueness is what a boot id needs, not secrecy: two boots must
 * not share one, and nothing is protected by it being hard to guess. Make it
 * once per runtime and pass it as `running.boot.id`.
 *
 * @example
 * ```ts
 * const running = { boot: { id: createBootId() } };
 * ```
 */
export const createBootId = (): string => {
  try {
    const source: RandomSource | undefined = globalThis.crypto;

    if (typeof source?.randomUUID === "function") {
      return source.randomUUID();
    }

    if (typeof source?.getRandomValues === "function") {
      const bytes = new Uint8Array(BYTES);

      source.getRandomValues(bytes);

      return formatVersion4(Array.from(bytes));
    }
  } catch {
    // A host whose source refuses is one that has none: the next source is as unique.
  }

  return formatVersion4(
    Array.from({ length: BYTES }, () => Math.floor(Math.random() * 256)),
  );
};

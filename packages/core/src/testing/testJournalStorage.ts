import { describe, expect, test } from "vitest";

import type { JournalStorageConformanceOptions } from "src/testing/types/JournalStorageConformanceOptions";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";

const sequence = { next: 0 };

// A key of the shape the journal writes, with separators, a percent sign and unicode in its partition, and new for every call so a backend that outlives a test cannot leak into the next.
const createKey = (label: string) => {
  sequence.next += 1;

  return createJournalKey({
    application: "com.example.conformance",
    environment: "test",
    platform: "web",
    distribution: "public-web",
    partition: `${label} ${sequence.next} é/%`,
  });
};

// What a record holds: JSON text, with quotes, escapes and whatever a build id or an account may contain.
const VALUES: Array<[string, string]> = [
  ["separators", '{"route":"web/ota","path":"a/b/c"}'],
  ["percent signs", "50% off, %2F, %ZZ and %"],
  ["unicode", "naïve café, 日本語, 😀 and  "],
  [
    "quotes, escapes and line breaks",
    '{"a":"line\\nbreak","b":"\\"q\\""}\r\n\t',
  ],
];

const createLargeRecord = () =>
  JSON.stringify({
    transitions: Array.from({ length: 80 }, (_, index) => ({
      boot: `boot-${index}-${"x".repeat(100)}`,
    })),
  });

/**
 * Registers the contract every journal storage keeps, over a fake of its
 * backend: a key nothing was written under reads `null`; a write resolves
 * only once its value can be read back, and overwrites what was there; a
 * remove deletes the value, and removing what is not there does not throw;
 * text with separators, percent signs and unicode, and a record of several
 * kilobytes, come back exactly; keys that look alike stay apart; and, when the
 * fixture gives `reopen`, what was written is still there after a restart, and
 * what was removed is still gone. Call it at the top level of a test file.
 *
 * It cannot check that a write survives a device failure, that the backend
 * really persists what the fake says it does, or how the storage behaves when
 * the backend fails: keep those in the storage's own tests.
 *
 * @example
 * ```ts
 * testJournalStorage({
 *   name: "key-value store",
 *   create: () => {
 *     const backend = new Map<string, string>();
 *
 *     const open = () =>
 *       keyValueJournalStorage({
 *         getItem: (key) => backend.get(key) ?? null,
 *         setItem: (key, value) => backend.set(key, value),
 *         removeItem: (key) => backend.delete(key),
 *       });
 *
 *     return { storage: open(), reopen: open };
 *   },
 * });
 * ```
 */
export const testJournalStorage = ({
  name,
  create,
}: JournalStorageConformanceOptions) => {
  describe(`journal storage: ${name}`, () => {
    test("a key nothing was written under reads null", async () => {
      const { storage } = await create();

      await expect(storage.read(createKey("missing"))).resolves.toBeNull();
    });

    test("a write resolves once its value can be read back", async () => {
      const { storage } = await create();
      const key = createKey("written");

      await storage.write(key, "first");

      await expect(storage.read(key)).resolves.toBe("first");
    });

    test("a write overwrites what was there", async () => {
      const { storage } = await create();
      const key = createKey("overwritten");

      await storage.write(key, "first");
      await storage.write(key, "second");

      await expect(storage.read(key)).resolves.toBe("second");
    });

    test("a remove deletes the value under its key and no other", async () => {
      const { storage } = await create();
      const removed = createKey("removed");
      const kept = createKey("kept");

      await storage.write(removed, "gone");
      await storage.write(kept, "stays");
      await storage.remove(removed);

      await expect(storage.read(removed)).resolves.toBeNull();
      await expect(storage.read(kept)).resolves.toBe("stays");
    });

    test("removing a key nothing was written under does not throw", async () => {
      const { storage } = await create();

      await expect(storage.remove(createKey("never"))).resolves.toBeUndefined();
    });

    for (const [label, value] of VALUES) {
      test(`a value with ${label} comes back exactly`, async () => {
        const { storage } = await create();
        const key = createKey("text");

        await storage.write(key, value);

        await expect(storage.read(key)).resolves.toBe(value);
      });
    }

    test("a record of several kilobytes comes back whole", async () => {
      const { storage } = await create();
      const key = createKey("large");
      const record = createLargeRecord();

      expect(record.length).toBeGreaterThan(8_192);

      await storage.write(key, record);

      await expect(storage.read(key)).resolves.toBe(record);
    });

    test("keys that look alike stay apart", async () => {
      const { storage } = await create();
      const base = createKey("apart");

      const keys = [
        base,
        `${base}/child`,
        `${base}%2Fchild`,
        `${base}%252Fchild`,
      ];

      for (const [index, key] of keys.entries()) {
        await storage.write(key, `value ${index}`);
      }

      for (const [index, key] of keys.entries()) {
        await expect(storage.read(key)).resolves.toBe(`value ${index}`);
      }
    });

    test("what was written is still there for a storage opened again over the backend", async (context) => {
      const { skip } = context;

      const { storage, reopen } = await create();

      if (reopen === undefined) {
        skip();

        return;
      }

      const key = createKey("persisted");

      await storage.write(key, "kept across a restart");

      const reopened = await reopen();

      await expect(reopened.read(key)).resolves.toBe("kept across a restart");
    });

    test("what was removed is still gone for a storage opened again over the backend", async (context) => {
      const { skip } = context;

      const { storage, reopen } = await create();

      if (reopen === undefined) {
        skip();

        return;
      }

      const key = createKey("forgotten");

      await storage.write(key, "to forget");
      await storage.remove(key);

      const reopened = await reopen();

      await expect(reopened.read(key)).resolves.toBeNull();
    });
  });
};

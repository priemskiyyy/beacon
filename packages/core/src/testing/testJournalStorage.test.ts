import { describe, expect, test, vi } from "vitest";

import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { listFailed, runCollected } from "src/testing/collectChecks.fixture";
import { testJournalStorage } from "src/testing/testJournalStorage";
import type { JournalStorageFixture } from "src/testing/types/JournalStorageFixture";
import type { JournalStorage } from "src/types/JournalStorage";

vi.mock("vitest", async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  const { collect } = await import("src/testing/collectChecks.fixture");

  return { ...actual, describe: collect.describe, test: collect.test };
});

// Registers the suite over these options, runs every check, and answers how each one ended.
const runSuite = (create: () => JournalStorageFixture) =>
  runCollected(() => {
    testJournalStorage({ name: "under test", create });
  });

// A storage that a test bends out of shape on purpose, which no type would let it write.
const bend = (parts: object): JournalStorage =>
  Object.assign(Object.create(null), parts);

// A storage over a map, which a test breaks one method at a time.
const createBroken = (
  override: (inner: JournalStorage, records: Map<string, string>) => object,
): (() => JournalStorageFixture) => {
  return () => {
    const inner = createMockJournalStorage();
    const storage = bend({ ...inner, ...override(inner, inner.records) });

    return {
      storage,
      reopen: () => {
        const reopened = createMockJournalStorage();

        for (const [key, value] of inner.records) {
          reopened.records.set(key, value);
        }

        return reopened;
      },
    };
  };
};

const CHECKS = {
  missing: "a key nothing was written under reads null",
  written: "a write resolves once its value can be read back",
  overwritten: "a write overwrites what was there",
  removed: "a remove deletes the value under its key and no other",
  neverWritten: "removing a key nothing was written under does not throw",
  separators: "a value with separators comes back exactly",
  percent: "a value with percent signs comes back exactly",
  unicode: "a value with unicode comes back exactly",
  escapes: "a value with quotes, escapes and line breaks comes back exactly",
  large: "a record of several kilobytes comes back whole",
  apart: "keys that look alike stay apart",
  persisted:
    "what was written is still there for a storage opened again over the backend",
  forgotten:
    "what was removed is still gone for a storage opened again over the backend",
};

describe("a storage that keeps the contract passes every check", () => {
  test("whether or not it can be opened again", async () => {
    const reopening = await runSuite(createBroken(() => ({})));

    const plain = await runSuite(() => ({
      storage: createMockJournalStorage(),
    }));

    expect(listFailed(reopening)).toEqual([]);
    expect(Object.keys(reopening).sort()).toEqual(Object.values(CHECKS).sort());
    expect(reopening).toEqual(
      Object.fromEntries(
        Object.values(CHECKS).map((title) => [title, "passed"]),
      ),
    );
    expect(plain).toEqual({
      ...reopening,
      [CHECKS.persisted]: "skipped",
      [CHECKS.forgotten]: "skipped",
    });
  });
});

describe("a storage that breaks the contract fails the checks that name it", () => {
  test("one that answers undefined for a key it does not hold", async () => {
    const outcomes = await runSuite(
      createBroken((inner) => ({
        read: async (key: string) => (await inner.read(key)) ?? undefined,
      })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.missing, CHECKS.removed]);
  });

  test("one that deletes nothing", async () => {
    const outcomes = await runSuite(
      createBroken(() => ({ remove: async () => {} })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.removed, CHECKS.forgotten]);
  });

  test("one that deletes every key", async () => {
    const outcomes = await runSuite(
      createBroken((_inner, records) => ({
        remove: async () => {
          records.clear();
        },
      })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.removed]);
  });

  test("one that throws when it is asked to remove what is not there", async () => {
    const outcomes = await runSuite(
      createBroken((inner, records) => ({
        remove: async (key: string) => {
          if (!records.has(key)) {
            throw new Error("No such key.");
          }

          await inner.remove(key);
        },
      })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.neverWritten]);
  });

  test("one that keeps the first value and ignores the next", async () => {
    const outcomes = await runSuite(
      createBroken((inner, records) => ({
        write: async (key: string, value: string) => {
          if (records.has(key)) {
            return;
          }

          await inner.write(key, value);
        },
      })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.overwritten]);
  });

  test("one that resolves a write and keeps nothing", async () => {
    const outcomes = await runSuite(
      createBroken(() => ({ write: async () => {} })),
    );

    expect(listFailed(outcomes)).toEqual([
      CHECKS.written,
      CHECKS.overwritten,
      CHECKS.removed,
      CHECKS.separators,
      CHECKS.percent,
      CHECKS.unicode,
      CHECKS.escapes,
      CHECKS.large,
      CHECKS.apart,
      CHECKS.persisted,
    ]);
  });

  test("one that refuses a record of several kilobytes", async () => {
    const outcomes = await runSuite(
      createBroken((inner) => ({
        write: async (key: string, value: string) => {
          if (value.length > 4_096) {
            throw new Error("The value is too large.");
          }

          await inner.write(key, value);
        },
      })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.large]);
  });

  test("one that reads a percent sign in a key as an escape, so that two keys become one", async () => {
    const outcomes = await runSuite(
      createBroken((inner) => ({
        read: (key: string) => inner.read(decodeURIComponent(key)),
        write: (key: string, value: string) =>
          inner.write(decodeURIComponent(key), value),
        remove: (key: string) => inner.remove(decodeURIComponent(key)),
      })),
    );

    expect(listFailed(outcomes)).toContain(CHECKS.apart);
  });

  test("one that changes the text it was given", async () => {
    const outcomes = await runSuite(
      createBroken((inner) => ({
        write: (key: string, value: string) =>
          inner.write(
            key,
            value.replaceAll(/\P{ASCII}/gu, "?").replaceAll("\r\n", "\n"),
          ),
      })),
    );

    expect(listFailed(outcomes)).toEqual([CHECKS.unicode, CHECKS.escapes]);
  });

  test("one that forgets everything when it is opened again", async () => {
    const outcomes = await runSuite(() => ({
      storage: createMockJournalStorage(),
      reopen: () => createMockJournalStorage(),
    }));

    expect(listFailed(outcomes)).toEqual([CHECKS.persisted]);
  });

  test("one that brings back what was removed when it is opened again", async () => {
    const outcomes = await runSuite(() => {
      const first = createMockJournalStorage();
      const written = new Map<string, string>();

      return {
        storage: bend({
          read: (key: string) => first.read(key),
          write: async (key: string, value: string) => {
            written.set(key, value);
            await first.write(key, value);
          },
          remove: (key: string) => first.remove(key),
        }),
        reopen: () => {
          const reopened = createMockJournalStorage();

          for (const [key, value] of written) {
            reopened.records.set(key, value);
          }

          return reopened;
        },
      };
    });

    expect(listFailed(outcomes)).toEqual([CHECKS.forgotten]);
  });
});

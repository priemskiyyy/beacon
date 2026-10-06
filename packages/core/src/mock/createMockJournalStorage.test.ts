import { expect, test } from "vitest";

import { createMockJournalStorage } from "src/mock/createMockJournalStorage";
import { settle } from "src/mock/settle";

const KEY = "beacon/v1/com.example.notes/production/web/public-web";

const watch = <TValue>(pending: Promise<TValue>) => {
  const seen: { value?: TValue; error?: unknown; done: boolean } = {
    done: false,
  };

  pending.then(
    (value) => {
      seen.value = value;
      seen.done = true;
    },
    (error: unknown) => {
      seen.error = error;
      seen.done = true;
    },
  );

  return seen;
};

test("it keeps what is written, answers null for what is not there, and forgets what is removed", async () => {
  const storage = createMockJournalStorage();

  await expect(storage.read(KEY)).resolves.toBeNull();

  await storage.write(KEY, "record");

  await expect(storage.read(KEY)).resolves.toBe("record");
  expect(storage.records.get(KEY)).toBe("record");

  await storage.remove(KEY);

  await expect(storage.read(KEY)).resolves.toBeNull();
  expect(storage.records.size).toBe(0);
});

test("a record a test puts in records is what a read answers", async () => {
  const storage = createMockJournalStorage();

  storage.records.set(KEY, "left by an earlier boot");

  await expect(storage.read(KEY)).resolves.toBe("left by an earlier boot");
});

test("it counts the reads and the writes it is asked for, those it refuses included", async () => {
  const storage = createMockJournalStorage();

  await storage.read(KEY);
  await storage.read(KEY);
  await storage.write(KEY, "record");
  await storage.remove(KEY);

  expect([storage.reads(), storage.writes()]).toEqual([2, 1]);

  storage.failReads();
  storage.failWrites();

  await storage.read(KEY).catch(() => {});
  await storage.write(KEY, "record").catch(() => {});

  expect([storage.reads(), storage.writes()]).toEqual([3, 2]);
});

test("held writes are answered only when released, and store nothing until then", async () => {
  const storage = createMockJournalStorage();

  storage.holdWrites();

  const first = watch(storage.write(`${KEY}/a`, "first"));
  const second = watch(storage.write(`${KEY}/b`, "second"));

  await settle();

  expect([first.done, second.done]).toEqual([false, false]);
  expect(storage.records.size).toBe(0);
  expect(storage.writes()).toBe(2);

  storage.releaseWrites();
  await settle();

  expect([first.done, second.done]).toEqual([true, true]);
  expect(storage.records.size).toBe(2);

  // Releasing stops holding.
  await storage.write(`${KEY}/c`, "third");

  expect(storage.records.get(`${KEY}/c`)).toBe("third");
});

test("held reads are answered only when released, with what is stored by then", async () => {
  const storage = createMockJournalStorage();

  storage.records.set(KEY, "before");
  storage.holdReads();

  const read = watch(storage.read(KEY));

  await settle();

  expect(read.done).toBe(false);

  storage.records.set(KEY, "after");
  storage.releaseReads();
  await settle();

  expect(read).toMatchObject({ done: true, value: "after" });

  await expect(storage.read(KEY)).resolves.toBe("after");
});

test("a read and a write are held apart: holding one leaves the other going", async () => {
  const storage = createMockJournalStorage();

  storage.holdReads();
  await storage.write(KEY, "record");

  storage.releaseReads();
  storage.holdWrites();

  await expect(storage.read(KEY)).resolves.toBe("record");
});

test("a failing write rejects with the error it was given, stores nothing, and stops when it is told null", async () => {
  const storage = createMockJournalStorage();
  const quota = new Error("quota exceeded");

  storage.failWrites(quota);

  await expect(storage.write(KEY, "record")).rejects.toBe(quota);
  expect(storage.records.size).toBe(0);

  storage.failWrites(null);

  await expect(storage.write(KEY, "record")).resolves.toBeUndefined();
  expect(storage.records.get(KEY)).toBe("record");
});

test("a failing read rejects with the error it was given, and stops when it is told null", async () => {
  const storage = createMockJournalStorage();
  const offline = new Error("storage offline");

  storage.records.set(KEY, "record");
  storage.failReads(offline);

  await expect(storage.read(KEY)).rejects.toBe(offline);

  storage.failReads(null);

  await expect(storage.read(KEY)).resolves.toBe("record");
});

test("a failure without an error is an error, and each knob is its own", async () => {
  const storage = createMockJournalStorage();

  storage.failWrites();

  await expect(storage.write(KEY, "record")).rejects.toThrow(
    "The storage refused the write.",
  );
  await expect(storage.read(KEY)).resolves.toBeNull();

  storage.failWrites(null);
  storage.failReads();

  await expect(storage.read(KEY)).rejects.toThrow(
    "The storage refused the read.",
  );
  await expect(storage.write(KEY, "record")).resolves.toBeUndefined();
});

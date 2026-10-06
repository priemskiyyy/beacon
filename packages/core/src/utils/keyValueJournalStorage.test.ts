import { expect, test } from "vitest";

import { createGate } from "src/mock/createGate";
import { settle } from "src/mock/settle";
import type { KeyValueStoreLike } from "src/types/KeyValueStoreLike";
import {
  ACCEPTED_RELOAD,
  createWebCommandBeacon,
  startWithOffer,
  takeRun,
} from "src/utils/commands.fixture";
import { keyValueJournalStorage } from "src/utils/keyValueJournalStorage";
import {
  BoundStore,
  createFakeStore,
  createLyingStore,
} from "src/utils/keyValueJournalStorage.fixture";

const KEY = "beacon/v1/com.example.notes/production/web/public-web";

const refuse = (message: string) => () => {
  throw new Error(message);
};

test("a key nothing was written under reads null, whether the store says null or undefined", async () => {
  const answers: Array<"null" | "undefined"> = ["null", "undefined"];

  for (const missing of answers) {
    const { store } = createFakeStore({ missing, answers: "later" });

    await expect(keyValueJournalStorage(store).read(KEY)).resolves.toBeNull();
  }
});

test("a call of the store that throws at once is a rejection, never a throw", async () => {
  const full = new Error("QuotaExceededError");

  const store: KeyValueStoreLike = {
    getItem: refuse("unreadable"),
    setItem: () => {
      throw full;
    },
    removeItem: refuse("unremovable"),
  };

  const storage = keyValueJournalStorage(store);

  const calls = [
    () => storage.read(KEY),
    () => storage.write(KEY, "record"),
    () => storage.remove(KEY),
  ];

  for (const call of calls) {
    let pending: Promise<unknown> | undefined;

    expect(() => {
      pending = call();
    }).not.toThrow();
    await expect(pending).rejects.toThrow();
  }

  await expect(storage.write(KEY, "record")).rejects.toBe(full);
});

test("a call the store answers with a rejection is a rejection", async () => {
  const offline = new Error("offline");

  const storage = keyValueJournalStorage({
    getItem: () => Promise.reject(offline),
    setItem: () => Promise.reject(offline),
    removeItem: () => Promise.reject(offline),
  });

  await expect(storage.read(KEY)).rejects.toBe(offline);
  await expect(storage.write(KEY, "record")).rejects.toBe(offline);
  await expect(storage.remove(KEY)).rejects.toBe(offline);
});

test("the store is called as a method of itself, as localStorage requires", async () => {
  const storage = keyValueJournalStorage(new BoundStore());

  await storage.write(KEY, "record");

  await expect(storage.read(KEY)).resolves.toBe("record");

  await storage.remove(KEY);

  await expect(storage.read(KEY)).resolves.toBeNull();
});

test("a write resolves only after the store answered its own write and its own remove", async () => {
  const setting = createGate();
  const removing = createGate();
  const { store, backend } = createFakeStore();

  const storage = keyValueJournalStorage({
    getItem: (key) => store.getItem(key),
    setItem: async (key, value) => {
      await setting.wait();
      await store.setItem(key, value);
    },
    removeItem: async (key) => {
      await removing.wait();
      await store.removeItem(key);
    },
  });

  const done = { write: false, remove: false };

  setting.hold();

  storage.write(KEY, "record").then(() => {
    done.write = true;
  });
  await settle();

  expect(done.write).toBe(false);
  expect(backend.has(KEY)).toBe(false);

  setting.release();
  await settle();

  expect(done.write).toBe(true);
  expect(backend.get(KEY)).toBe("record");

  removing.hold();

  storage.remove(KEY).then(() => {
    done.remove = true;
  });
  await settle();

  expect(done.remove).toBe(false);
  expect(backend.has(KEY)).toBe(true);

  removing.release();
  await settle();

  expect(done.remove).toBe(true);
  expect(backend.has(KEY)).toBe(false);
});

test("a write is read back once, and the record read is the one the store keeps", async () => {
  const { store, calls } = createFakeStore({ answers: "later" });

  await keyValueJournalStorage(store).write(KEY, "record");

  expect(calls).toEqual([`set ${KEY}`, `get ${KEY}`]);
});

test("JOURNAL-08 a store that accepts a write and keeps nothing fails the write, since the record is read back", async () => {
  const storage = keyValueJournalStorage(createLyingStore());

  await expect(storage.write(KEY, "record")).rejects.toThrow(
    "The store accepted the record and did not keep it.",
  );
});

test("a store that keeps something other than the record fails the write", async () => {
  const storage = keyValueJournalStorage({
    getItem: () => "truncated",
    setItem: () => undefined,
    removeItem: () => undefined,
  });

  await expect(storage.write(KEY, "record")).rejects.toThrow("did not keep");
});

test("a write that is not verified resolves when the store answered it, read back or not", async () => {
  const { store, calls } = createFakeStore();

  await expect(
    keyValueJournalStorage(store, { verify: false }).write(KEY, "record"),
  ).resolves.toBeUndefined();
  expect(calls).toEqual([`set ${KEY}`]);

  await expect(
    keyValueJournalStorage(createLyingStore(), { verify: false }).write(
      KEY,
      "record",
    ),
  ).resolves.toBeUndefined();
});

test("the store sees the key it was mapped to, for a read, a write and a remove, and never the journal's", async () => {
  const { store, calls } = createFakeStore();

  const storage = keyValueJournalStorage(store, {
    key: (journalKey) => journalKey.replaceAll(/\W/g, "_"),
  });

  await storage.write(KEY, "record");
  await storage.read(KEY);
  await storage.remove(KEY);

  const mapped = "beacon_v1_com_example_notes_production_web_public_web";

  expect(calls).toEqual([
    `set ${mapped}`,
    `get ${mapped}`,
    `get ${mapped}`,
    `remove ${mapped}`,
  ]);
});

test("JOURNAL-08 a required journal over a store that keeps nothing stops the command before the provider, and with the read back turned off it does not", async () => {
  const lying = createWebCommandBeacon({
    journal: {
      mode: "required",
      storage: keyValueJournalStorage(createLyingStore()),
    },
  });

  const offer = await startWithOffer(lying);

  await expect(
    lying.beacon.route("web").reload({ offer }),
  ).resolves.toMatchObject({
    status: "failed",
    error: { code: "JOURNAL_FAILED" },
  });
  expect(lying.runs).toHaveLength(0);

  const unverified = createWebCommandBeacon({
    journal: {
      mode: "required",
      storage: keyValueJournalStorage(createLyingStore(), { verify: false }),
    },
  });

  const unverifiedOffer = await startWithOffer(unverified);

  const pending = unverified.beacon
    .route("web")
    .reload({ offer: unverifiedOffer });

  await settle();
  takeRun(unverified.runs).settleWith(ACCEPTED_RELOAD);

  await expect(pending).resolves.toMatchObject({ status: "accepted" });
});

test("JOURNAL-04 a reload recorded through a store is read back by the next boot of a storage opened again over it", async () => {
  const { store, backend } = createFakeStore({ answers: "later" });

  const first = createWebCommandBeacon({
    journal: { mode: "required", storage: keyValueJournalStorage(store) },
  });

  const offer = await startWithOffer(first);
  const pending = first.beacon.route("web").reload({ offer });

  await settle();
  takeRun(first.runs).settleWith(ACCEPTED_RELOAD);
  await pending;

  expect([...backend.keys()]).toEqual([KEY]);

  const next = createWebCommandBeacon({
    boot: "boot-2",
    build: "web-build-a",
    journal: {
      mode: "required",
      storage: keyValueJournalStorage(createFakeStore({ backend }).store),
    },
  });

  next.beacon.start();
  await settle();

  expect(next.beacon.transitions.get()).toMatchObject({
    journal: "ready",
    latest: { outcome: "target-running", intent: { boot: { id: "boot-1" } } },
  });
});

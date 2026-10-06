import { expect, test } from "vitest";

import { createJournalStorage } from "src/lab/createJournalStorage";

// A key-value store of the kind AsyncStorage, MMKV's async wrappers and `expo-sqlite/kv-store` are, in memory.
const memoryStore = () => {
  const values = new Map<string, string>();

  return {
    values,
    getItem: async (key: string) => values.get(key) ?? null,
    setItem: async (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: async (key: string) => {
      values.delete(key);
    },
  };
};

test("the journal reads, writes and removes through the store it is given", async () => {
  const store = memoryStore();
  const storage = createJournalStorage(store);

  await expect(storage.read("beacon/v1/key")).resolves.toBeNull();

  await storage.write("beacon/v1/key", "record");

  await expect(storage.read("beacon/v1/key")).resolves.toBe("record");
  expect(store.values.get("beacon/v1/key")).toBe("record");

  await storage.remove("beacon/v1/key");

  await expect(storage.read("beacon/v1/key")).resolves.toBeNull();
});

test("a write the store rejects is rejected, since a required journal must not take it for persisted", async () => {
  const storage = createJournalStorage({
    getItem: async () => null,
    setItem: async () => {
      throw new Error("disk full");
    },
    removeItem: async () => {},
  });

  await expect(storage.write("key", "record")).rejects.toThrow("disk full");
});

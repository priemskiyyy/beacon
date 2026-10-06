import type { KeyValueStoreLike } from "src/types/KeyValueStoreLike";

type FakeStoreOptions = {
  /** Holds what is stored, so two stores over one backend stand for a store opened again after a restart. */
  backend?: Map<string, string>;
  /** What a key nothing was written under answers: `null`, as `localStorage` does, or `undefined`, as some stores do. */
  missing?: "null" | "undefined";
  /** Whether every call answers with a promise, as AsyncStorage does, or at once, as `localStorage` does. */
  answers?: "at-once" | "later";
};

/** A key-value store over a map, with every call it was asked for in `calls`. */
export const createFakeStore = ({
  backend = new Map(),
  missing = "null",
  answers = "at-once",
}: FakeStoreOptions = {}) => {
  const calls: string[] = [];

  const answer = <TValue>(value: TValue) => {
    if (answers === "later") {
      return Promise.resolve(value);
    }

    return value;
  };

  const store: KeyValueStoreLike = {
    getItem: (key) => {
      calls.push(`get ${key}`);

      const value = backend.get(key);

      if (value === undefined && missing === "null") {
        return answer(null);
      }

      return answer(value);
    },
    setItem: (key, value) => {
      calls.push(`set ${key}`);
      backend.set(key, value);

      return answer(undefined);
    },
    removeItem: (key) => {
      calls.push(`remove ${key}`);
      backend.delete(key);

      return answer(undefined);
    },
  };

  return { store, backend, calls };
};

/** A store whose methods only work when called on it, as `localStorage`'s do. */
export class BoundStore implements KeyValueStoreLike {
  #items = new Map<string, string>();

  getItem(key: string) {
    return this.#items.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.#items.set(key, value);
  }

  removeItem(key: string) {
    this.#items.delete(key);
  }
}

/** A store that accepts every write and keeps nothing. */
export const createLyingStore = (): KeyValueStoreLike => ({
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
});

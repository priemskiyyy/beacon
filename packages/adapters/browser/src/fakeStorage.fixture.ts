import type { KeyValueStoreLike } from "@priemskiyyy/beacon";

import type { BrowserStorageArea } from "src/types/BrowserStorageArea";
import type { BrowserStorageWindowLike } from "src/types/BrowserStorageWindowLike";

export type FakeStorage = KeyValueStoreLike & {
  /** What is stored, by key. */
  items: Map<string, string>;
  reads: () => number;
  writes: () => number;
  removes: () => number;
};

type FakeStorageOptions = {
  /** The most characters of keys and values it holds, as a browser's quota is counted; past it a write throws `QuotaExceededError`. */
  capacity?: number;
  /** False for a storage that accepts a write and keeps nothing. */
  keeps?: boolean;
};

// Web Storage as a test scripts it: text under keys, `null` for a key nothing was written under, a quota that throws as a browser's does, and calls it counts.
export const fakeStorage = ({
  capacity = Number.POSITIVE_INFINITY,
  keeps = true,
}: FakeStorageOptions = {}): FakeStorage => {
  const items = new Map<string, string>();
  const counts = { reads: 0, writes: 0, removes: 0 };

  const size = (without: string) => {
    let total = 0;

    for (const [key, value] of items) {
      if (key === without) {
        continue;
      }

      total += key.length + value.length;
    }

    return total;
  };

  return {
    items,
    getItem: (key) => {
      counts.reads += 1;

      return items.get(key) ?? null;
    },
    setItem: (key, value) => {
      counts.writes += 1;

      if (size(key) + key.length + value.length > capacity) {
        throw new DOMException(
          "Failed to execute 'setItem' on 'Storage': Setting the value exceeded the quota.",
          "QuotaExceededError",
        );
      }

      if (!keeps) {
        return;
      }

      items.set(key, value);
    },
    removeItem: (key) => {
      counts.removes += 1;
      items.delete(key);
    },
    reads: () => counts.reads,
    writes: () => counts.writes,
    removes: () => counts.removes,
  };
};

type FakeStorageWindowOptions = {
  session?: FakeStorage;
  local?: FakeStorage;
  /** The areas whose property throws a `SecurityError` when read, as in a sandboxed frame. Changing it changes the next read. */
  blocked?: Set<BrowserStorageArea>;
};

// A window whose two areas are fakes, whose properties are read through getters that count, and that can refuse them as a sandboxed frame does.
export const fakeStorageWindow = ({
  session = fakeStorage(),
  local = fakeStorage(),
  blocked = new Set(),
}: FakeStorageWindowOptions = {}) => {
  const lookups = { session: 0, local: 0 };

  const refuse = (property: string) =>
    new DOMException(
      `Failed to read the '${property}' property from 'Window': Access is denied for this document.`,
      "SecurityError",
    );

  const window: BrowserStorageWindowLike = {
    get sessionStorage() {
      lookups.session += 1;

      if (blocked.has("session")) {
        throw refuse("sessionStorage");
      }

      return session;
    },
    get localStorage() {
      lookups.local += 1;

      if (blocked.has("local")) {
        throw refuse("localStorage");
      }

      return local;
    },
  };

  return {
    window,
    session,
    local,
    blocked,
    lookups: () => lookups.session + lookups.local,
  };
};

// Typechecked, never run: the real stores' own declarations satisfy the
// structural type `keyValueJournalStorage` takes, so the core imports none of
// them at runtime, and a store without one of its three calls does not compile.
import AsyncStorageV3, {
  createAsyncStorage,
} from "@react-native-async-storage/async-storage";
import AsyncStorageV2 from "async-storage-v2";
import KvStore from "expo-sqlite/kv-store";
import { createMMKV } from "react-native-mmkv";
import type { MMKV as Mmkv4 } from "react-native-mmkv";
import type { MMKV as Mmkv3 } from "react-native-mmkv-v3";
import { expectTypeOf } from "vitest";

import type { JournalOptions } from "src/types/JournalOptions";
import type { JournalStorage } from "src/types/JournalStorage";
import type { KeyValueStoreLike } from "src/types/KeyValueStoreLike";
import { keyValueJournalStorage } from "src/utils/keyValueJournalStorage";

// A declaration that did not resolve would be `any` and satisfy everything.
type IsAny<TValue> = 0 extends 1 & TValue ? true : false;

// The recipe of docs/journal.md: MMKV 3 has `delete`, MMKV 4 renamed it `remove`, and the string is written and read as one in both.
type MmkvLike = {
  getString(key: string): string | undefined;
  set(key: string, value: string): unknown;
} & ({ remove(key: string): unknown } | { delete(key: string): unknown });

const mmkvStore = (mmkv: MmkvLike): KeyValueStoreLike => ({
  getItem: (key) => mmkv.getString(key) ?? null,
  setItem: (key, value) => mmkv.set(key, value),
  removeItem: (key) => {
    if ("remove" in mmkv) {
      return mmkv.remove(key);
    }

    return mmkv.delete(key);
  },
});

declare const mmkv4: Mmkv4;

declare const mmkv3: Mmkv3;

expectTypeOf<IsAny<typeof AsyncStorageV3>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof AsyncStorageV2>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<typeof KvStore>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<Mmkv4>>().toEqualTypeOf<false>();
expectTypeOf<IsAny<Mmkv3>>().toEqualTypeOf<false>();

expectTypeOf(AsyncStorageV3.getItem).toEqualTypeOf<
  (key: string) => Promise<string | null>
>();
expectTypeOf(KvStore.getItem).toEqualTypeOf<
  (key: string) => Promise<string | null>
>();
expectTypeOf(mmkv4.getString).toEqualTypeOf<
  (key: string) => string | undefined
>();
expectTypeOf(mmkv3.getString).toEqualTypeOf<
  (key: string) => string | undefined
>();

// Web Storage, for React on the web.
expectTypeOf(localStorage).toExtend<KeyValueStoreLike>();
expectTypeOf(sessionStorage).toExtend<KeyValueStoreLike>();

// AsyncStorage 3, by its default export and as a named database, and AsyncStorage 2, whose calls take an optional callback.
expectTypeOf(AsyncStorageV3).toExtend<KeyValueStoreLike>();
expectTypeOf(AsyncStorageV2).toExtend<KeyValueStoreLike>();

export const asyncStorage: JournalStorage =
  keyValueJournalStorage(AsyncStorageV3);

export const namedAsyncStorage: JournalStorage = keyValueJournalStorage(
  createAsyncStorage("beacon"),
);

export const asyncStorageTwo: JournalStorage =
  keyValueJournalStorage(AsyncStorageV2);

// expo-sqlite's drop-in for AsyncStorage, whose `setItem` also takes an updater.
export const expoKeyValueStore: JournalStorage =
  keyValueJournalStorage(KvStore);

export const localJournal: JournalStorage =
  keyValueJournalStorage(localStorage);

export const sessionJournal: JournalStorage =
  keyValueJournalStorage(sessionStorage);

// Both majors of MMKV satisfy the one recipe, which takes whichever removes.
expectTypeOf(mmkv4).toExtend<MmkvLike>();
expectTypeOf(mmkv3).toExtend<MmkvLike>();

export const mmkvFour: JournalStorage = keyValueJournalStorage(
  mmkvStore(createMMKV({ id: "beacon" })),
);

export const mmkvThree: JournalStorage = keyValueJournalStorage(
  mmkvStore(mmkv3),
);

// @ts-expect-error A store without removeItem cannot drop a record.
keyValueJournalStorage({ getItem: () => null, setItem: () => undefined });

// @ts-expect-error A store without setItem cannot keep one.
keyValueJournalStorage({ getItem: () => null, removeItem: () => undefined });

keyValueJournalStorage({
  // @ts-expect-error A store whose getItem answers a number is not a string store.
  getItem: () => 1,
  setItem: () => undefined,
  removeItem: () => undefined,
});

keyValueJournalStorage(localStorage, {
  // @ts-expect-error The key mapping takes a string and answers one.
  key: (journalKey: number) => journalKey,
});

// @ts-expect-error An MMKV instance has no getItem, so it needs the recipe.
keyValueJournalStorage(mmkv4);

// The journal takes a key-value store as it is, and a mode is optional.
export const journalOverStore: JournalOptions = { storage: localStorage };

export const requiredOverAsyncStorage: JournalOptions = {
  mode: "required",
  storage: AsyncStorageV3,
};

export const ownStorage: JournalOptions = { storage: localJournal };

// @ts-expect-error A storage is a journal storage or a key-value store, not an object with neither.
export const neither: JournalOptions = { storage: {} };

export const unknownMode: JournalOptions = {
  // @ts-expect-error The mode is best-effort or required.
  mode: "sometimes",
  storage: localStorage,
};

// @ts-expect-error An MMKV instance is no key-value store of the journal's either, so it needs the recipe.
export const mmkvJournal: JournalOptions = { storage: mmkv4 };

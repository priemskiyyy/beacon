---
description: "Turn on the transition journal to learn on the next boot what a reload led to: intents, storage, checkpoints, boot reconciliation and the attempt budget."
---

# Journal

A reload replaces the code that asked for it. The new boot has to find out for itself whether the reload reached its target. The journal is how it does: Beacon writes an intent before a command that replaces the realm, and the next boot reads it back and compares it with what now runs.

It is off by default. Without it, `beacon.transitions` says so, and nothing is correlated across boots.

## Turn it on

The journal keeps its record in storage you provide, as strings under keys. `keyValueJournalStorage` adapts any store with `getItem`, `setItem` and `removeItem`, which is what AsyncStorage, `expo-sqlite/kv-store`, `localStorage` and most stores have. [Choosing a storage](#choosing-a-storage) says which one to use.

```ts
import {
  Beacon,
  createBootId,
  keyValueJournalStorage,
  targetRoute,
} from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

declare const __BUILD_ID__: string;

// `localStorage` is reached at each call, so a page without it fails the journal and not the import.
const storage = keyValueJournalStorage({
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
});

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

const routes = { web: { kind: "target" } } satisfies RouteDeclarations;

const manifest = http({
  fetch: async ({ scope, signal }) =>
    readStandardManifest({
      response: await fetch("/releases.json", { signal }),
      scope,
      routes,
      now: Date.now(),
    }),
});

export const beacon = new Beacon({
  scope,
  running: {
    boot: { id: createBootId() },
    web: () => ({
      identity: {
        status: "known",
        authority: scope.application,
        domain: "web-artifact",
        value: __BUILD_ID__,
      },
      label: __BUILD_ID__,
      raw: {},
    }),
  },
  routes: {
    web: targetRoute({
      subject: "web",
      source: manifest.select((document) => document.routes.web),
      mechanism: browserReload(),
    }),
  },
  journal: { mode: "required", storage, budget: 3, retention: 86_400_000 },
});
```

In React Native, hand it the store you already use:

```ts
import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import type { JournalOptions } from "@priemskiyyy/beacon";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const journal = {
  mode: "required",
  storage: keyValueJournalStorage(AsyncStorage),
} satisfies JournalOptions;
```

A write that resolves must mean the value was persisted, not merely queued. A `required` journal treats anything else as a failure, and a store that accepts a write and keeps nothing would make it lie. `keyValueJournalStorage` therefore reads the record back after every write, and fails the write when the store shows something else.

| Option      | Default            | Meaning                                                                 |
| ----------- | ------------------ | ----------------------------------------------------------------------- |
| `mode`      |                    | `best-effort` goes on when a write fails. `required` stops the command  |
| `storage`   |                    | your `read`, `write` and `remove`                                       |
| `budget`    | 3                  | how many boots in a row may leave a target unreached before `exhausted` |
| `retention` | 86,400,000 (a day) | milliseconds an intent is kept                                          |

A budget that is not a positive whole number, and a retention that is not a positive whole number of milliseconds, are refused with `INVALID_CONFIGURATION` when the Beacon is made.

## Choosing a storage

The journal wants one whole record, read, written and removed under one key, and a write that resolves only once the record can be read back. Every store below has the three calls `keyValueJournalStorage` takes, at once or later, so each is one line.

| Store                  | For the journal  | Why                                                                                                                                |
| ---------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `expo-sqlite/kv-store` | Yes, on Expo     | The Expo SDK's own drop-in for AsyncStorage over SQLite, so the choice that adds no third-party native module.                     |
| AsyncStorage           | Yes              | The same three calls in version 2 and in version 3, on the device, asynchronous.                                                   |
| MMKV                   | Yes, with recipe | Synchronous and on the device. Version 4 names `remove` what version 3 calls `delete`, and it needs a native build.                |
| `sessionStorage`       | Yes, on the web  | Survives a reload in the same tab, which is the boot the journal reads the intent back in, and is gone when the tab closes.        |
| `localStorage`         | Yes, on the web  | Survives the tab too, so a fresh tab can judge another tab's intent. Tabs share the one record, and the last write wins.           |
| SecureStore, keychain  | No               | Keys must match `[\w.-]+`, which the journal's do not. Large values are rejected on iOS, and what they hold outlives an uninstall. |

### React Native

AsyncStorage and `expo-sqlite/kv-store` are handed over as they are.

```ts
import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import KvStore from "expo-sqlite/kv-store";

export const storage = keyValueJournalStorage(KvStore);
```

MMKV has no `getItem`. Its `getString` and `set` are adapted in a few lines, and whichever of `remove` and `delete` the installed version has removes the record.

```ts
import { keyValueJournalStorage } from "@priemskiyyy/beacon";
import type { KeyValueStoreLike } from "@priemskiyyy/beacon";
import { createMMKV } from "react-native-mmkv";

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

export const storage = keyValueJournalStorage(
  mmkvStore(createMMKV({ id: "beacon" })),
);
```

MMKV 3 makes its instance with `new MMKV({ id: "beacon" })`, and the rest does not change. Both majors are typechecked against this recipe.

### React on the web

Reach `localStorage` or `sessionStorage` at each call, so a page that has neither, such as a sandboxed frame or a server render, fails the journal and not the import.

```ts
import { keyValueJournalStorage } from "@priemskiyyy/beacon";

export const storage = keyValueJournalStorage({
  getItem: (key) => sessionStorage.getItem(key),
  setItem: (key, value) => sessionStorage.setItem(key, value),
  removeItem: (key) => sessionStorage.removeItem(key),
});
```

A full storage throws at once, and `keyValueJournalStorage` turns that into a rejected write: a `required` journal stops the command, and `best-effort` goes on with the intent in memory.

### What to know

- **The key names the scope in plain text.** It is `beacon/v1/<application>/<environment>/<platform>/<distribution>`, with the partition appended when there is one. Make the partition an opaque id, never an address or a token. A departed partition's record stays until `clearJournal()` removes it, so clear the journal before `replaceScope` when someone signs out.
- **The read back costs one read per write.** A record is a few kilobytes at most, about 4.2 KB at its capacity of 8 intents. Pass `{ verify: false }` only for a store that is known to keep what it accepts.
- **A store that hangs is bounded.** Every call is given up on at `timeouts.journal`, and what a slow write answers later is ignored, though it may still land.
- **A narrow key alphabet is mapped, not avoided.** `{ key: (journalKey) => ... }` gives the store its own key, and it must be injective: two journal keys that map to one would make two scopes share a record.
- **Prove a store you wrote.** `testJournalStorage` from `@priemskiyyy/beacon/testing` holds it to the contract, and `createMockJournalStorage` from `@priemskiyyy/beacon/mock` stands in for one in tests. See [testing](testing.md#a-journal-storage).

## What is written, and when

Only a command that replaces the realm writes an intent: `document-replacement` or `javascript-restart`. Only a reload or a restart has a next boot to read the intent back. A download that may activate on the next start writes nothing.

The intent says which command on which route, from which boot, what was running, and what the command aimed at. A command issued while the session opens first waits for its subject's running reader, bounded by `timeouts.running`, so `current` names what the reader answered; with the journal off it waits for nothing.

| Field                    | Meaning                                                            |
| ------------------------ | ------------------------------------------------------------------ |
| `operation`, `boot`      | the operation id, and the boot that made the request               |
| `route`, `command`       | what was asked                                                     |
| `subject`                | the running subject that would change                              |
| `current`, `target`      | the identity that ran, and the one the command aimed at, or `null` |
| `binding`                | how tightly the command was bound to the target                    |
| `createdAt`, `expiresAt` | epoch milliseconds                                                 |

It holds no native object, credential, manifest or account detail. It is an intent. It is not proof that the dispatch happened, and it never says anything was installed.

The record lives under one key for each scope, `beacon/v1/<application>/<environment>/<platform>/<distribution>`, with the partition appended when there is one, each part URI encoded. One scope never reads another's record. It holds at most 8 transitions. Older ones are let go and counted in `dropped`, so the loss of coverage is visible.

### When a write fails

- With `required`, the command stops before the provider is asked and settles as `failed` with `JOURNAL_FAILED`.
- With `best-effort`, the command goes on, the journal is `degraded`, and the intent lives in memory only. It correlates this boot and no later one.
- Every call to your storage is bounded by `timeouts.journal` (10,000 milliseconds by default). A call that does not answer in time counts as failed, and its late answer is ignored and counted as a `late-callback`. A slow write that was abandoned may still land in storage later, so a storage should not hold on to a write it was told to forget.
- A record that could not be read is not replaced by one that knows nothing of it. The journal says `degraded` and the write fails the same way.

## What the next boot says

`beacon.transitions` is an observable.

```ts
const stop = beacon.transitions.subscribe(() => {
  const { journal, latest, dropped, checkpoints } = beacon.transitions.get();

  if (journal !== "ready" || latest === null) {
    return;
  }

  console.info(latest.outcome, latest.attempts, latest.exhausted);
  console.info(dropped, checkpoints);
});
```

| Field         | Meaning                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `journal`     | `off`, `reading`, `ready`, or `degraded` because a read, a write or a remove failed or timed out |
| `latest`      | the most recent intent, and its `outcome`, `attempts` and `exhausted`                            |
| `dropped`     | intents let go because the capacity or their retention ran out                                   |
| `checkpoints` | the readiness checkpoints this boot reported                                                     |

When the session opens, the journal reads the record once, waits until every running reader has answered, failed or timed out, and judges each intent from an earlier boot against what runs now. It writes the judged record back. An intent is judged once, by the first boot after it, and then keeps its outcome. An intent from this boot is not judged, since nothing new was observed.

| `outcome`            | Means                                                                                         |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `same-boot`          | no new boot yet, so the action may still be unresolved                                        |
| `target-running`     | a new boot runs the comparable target it aimed at                                             |
| `target-not-running` | a new boot runs what ran before, so the target was not reached, for a reason this cannot tell |
| `different-target`   | a new boot runs something else than it aimed at, and its identity is kept                     |
| `inconclusive`       | an identity is unknown or incomparable, which is neither success nor failure                  |

None of them is a causal or a crash-free claim. A match of labels alone never matches, and an identity of another domain is inconclusive.

### The budget

`attempts` counts the boots in a row that left the same target unreached, this one included once it is known to have. The same attempt is the same command on the same route at the same target. Any other outcome, or a different target, starts the count again, so a new deployment decision is never charged for an old one. Several intents of one boot are one boot.

`exhausted` becomes true when `attempts` reaches the budget.

```ts
const { latest } = beacon.transitions.get();

if (latest?.exhausted) {
  console.warn("The same reload keeps landing on the same build.");
}
```

It is information. Nothing in Beacon gates a command on it, since no scheduler exists to automate one. Use it to stop an automatic reload and to ask the user to acknowledge.

## Checkpoints

A target that runs is not the same as a target that works. `beacon.reportReady({ checkpoint })` is the application saying its own code reached a point, such as the primary screen with the data it needs.

```ts
const report = beacon.reportReady({ checkpoint: "primary-screen" });

console.info(report.status); // "recorded", or "already-recorded" the second time
```

It is idempotent per checkpoint, and `checkpoint` defaults to `ready`. After `dispose()` it throws `DISPOSED`. It says application code got there. It does not say that nothing will crash later or that stored data is safe in both directions, and nothing reports it for you. A target that runs without a reported checkpoint has unknown readiness, neither failed nor succeeded.

## Clearing it

```ts
await beacon.clearJournal();
```

For a privacy flow. It removes the record and forgets what it held. Nothing stored is replayed and no native operation is cancelled. It still erases the stored record after `dispose()`, because the record outlives the Beacon.

It also recovers a journal that could not read its record. That journal says `degraded`, and every command that replaces the realm fails with `JOURNAL_FAILED` in `required` mode, since a record that could not be read is never replaced by one that knows nothing of it. Once `clearJournal()` has removed the record, the journal holds an empty one it knows, and says `ready`. A removal that fails leaves it `degraded`.

## Limits

- Two tabs, or two runtimes, share no atomic counter. The last write wins and is what a later boot reads.
- A corrupt record, and a record of a future schema, are ignored with a diagnostic and never executed.
- Storage that lies about a write defeats a `required` journal, unless the record is read back, which `keyValueJournalStorage` does unless told not to. Neither mode proves storage survives a device failure or tampering.
- A page restored from the back-forward cache is the same boot. See [browser](browser.md#a-page-restored-from-the-back-forward-cache).

When the scope is replaced, the intents of the scope that ended are forgotten in memory and the next session reads the record of the next scope. See [scopes](scopes.md).

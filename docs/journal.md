---
description: "Turn on the transition journal to learn on the next boot what a reload led to: intents, storage, checkpoints, boot reconciliation, and the attempt budget for the advanced."
---

# Journal

A reload replaces the code that asked for it. The new boot has to find out for itself whether the reload reached its target. The journal is how it does: Beacon writes an intent before a command that replaces the realm, and the next boot reads it back and compares it with what now runs.

It is off by default. Without it, `beacon.transitions` says so, and nothing is correlated across boots.

## Turn it on

The journal keeps its record in storage you provide, as strings under keys. Hand it any key-value store with `getItem`, `setItem` and `removeItem`, which is what AsyncStorage, `expo-sqlite/kv-store`, `localStorage` and most stores have, and Beacon wraps it with `keyValueJournalStorage`, which reads the record back after every write. `browserStorage()` of `@priemskiyyy/beacon-browser` is that over the browser's web storage. [Choosing a storage](#choosing-a-storage) says which one to use.

```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export const journal = { storage: AsyncStorage };
```

That is the whole option in React Native. The mode is `best-effort` unless you say `required`, so a broken store never blocks an update. On the web, with the routes around it:

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import {
  browserReload,
  browserStorage,
  webBuild,
} from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

declare const __BUILD_ID__: string;

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
    web: webBuild({ id: __BUILD_ID__ }),
  },
  routes: {
    web: targetRoute({
      source: manifest.select((document) => document.routes.web),
      mechanism: browserReload(),
    }),
  },
  journal: { mode: "required", storage: browserStorage() },
});
```

A write that resolves must mean the value was persisted, not merely queued. A `required` journal treats anything else as a failure, and a store that accepts a write and keeps nothing would make it lie. `keyValueJournalStorage` therefore reads the record back after every write, and fails the write when the store shows something else. A store you hand over as it is gets that read back. Wrap it yourself to pass `{ verify: false }` or a `key` mapping.

| Option    | Default       | Meaning                                                                                                                  |
| --------- | ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `mode`    | `best-effort` | `best-effort` goes on when a write fails. `required` stops the command                                                   |
| `storage` |               | a key-value store with `getItem`, `setItem` and `removeItem`, or a storage of your own with `read`, `write` and `remove` |

The options `budget` and `retention` are [advanced](#advanced-the-budget-and-the-retention).

## Choosing a storage

The journal wants one whole record, read, written and removed under one key, and a write that resolves only once the record can be read back. Every store below has the three calls `keyValueJournalStorage` takes, at once or later, so each is one line.

| Store                  | For the journal  | Why                                                                                                                                                           |
| ---------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `expo-sqlite/kv-store` | Yes, on Expo     | The Expo SDK's own drop-in for AsyncStorage over SQLite, so the choice that adds no third-party native module.                                                |
| AsyncStorage           | Yes              | The same three calls in version 2 and in version 3, on the device, asynchronous.                                                                              |
| MMKV                   | Yes, with recipe | Synchronous and on the device. Version 4 names `remove` what version 3 calls `delete`, and it needs a native build.                                           |
| `sessionStorage`       | Yes, on the web  | `browserStorage()`. Survives a reload in the same tab, which is the boot the journal reads the intent back in, and is gone when the tab closes.               |
| `localStorage`         | Yes, on the web  | `browserStorage({ area: "local" })`. Survives the tab too, so a fresh tab can judge another tab's intent. Tabs share the one record, and the last write wins. |
| SecureStore, keychain  | No               | Keys must match `[\w.-]+`, which the journal's do not. Large values are rejected on iOS, and what they hold outlives an uninstall.                            |

### React Native

AsyncStorage and `expo-sqlite/kv-store` are handed over as they are.

```ts
import KvStore from "expo-sqlite/kv-store";

export const journal = { storage: KvStore };
```

MMKV has no `getItem`. Its `getString` and `set` are adapted in a few lines, and whichever of `remove` and `delete` the installed version has removes the record.

```ts
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

export const journal = { storage: mmkvStore(createMMKV({ id: "beacon" })) };
```

MMKV 3 makes its instance with `new MMKV({ id: "beacon" })`, and the rest does not change. Both majors are typechecked against this recipe.

### React on the web

`browserStorage()` of `@priemskiyyy/beacon-browser` keeps the record in the tab's `sessionStorage`. The next boot after `location.reload()` is the same tab, so it reads what the last boot wrote, and no other tab can overwrite it. `area: "local"` uses `localStorage`, so a fresh tab can judge another tab's intent, and every tab then shares the one record.

```ts
import { browserStorage } from "@priemskiyyy/beacon-browser";

export const storage = browserStorage();
export const shared = browserStorage({ area: "local" });
```

It reaches the storage at each call and touches nothing when it is made, so a page that has none, such as a sandboxed frame or a server render, fails the journal and not the import. A full storage throws at once, and the journal turns that into a rejected write: a `required` journal stops the command, and `best-effort` goes on with the intent in memory. [Browser](browser.md#journal-storage) has the options. Safari's private browsing and the eviction of site data are the browser's and have not been run.

### What to know

- **The key names the scope in plain text.** It is `beacon/v1/<application>/<environment>/<platform>/<distribution>`, with the partition appended when there is one. Make the partition an opaque id, never an address or a token. A departed partition's record stays until `clearJournal()` removes it, so clear the journal before `replaceScope` when someone signs out.
- **The read back costs one read per write.** A record is a few kilobytes at most, about 4.2 KB at its capacity of 8 intents. Wrap the store in `keyValueJournalStorage(store, { verify: false })` only when it is known to keep what it accepts.
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

  console.info(latest.outcome, latest.judgedHere);
  console.info(dropped, checkpoints);
});
```

| Field         | Meaning                                                                                          |
| ------------- | ------------------------------------------------------------------------------------------------ |
| `journal`     | `off`, `reading`, `ready`, or `degraded` because a read, a write or a remove failed or timed out |
| `latest`      | the most recent intent, and its `outcome`, `judgedHere`, `attempts` and `exhausted` (advanced)   |
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

### Saying "Updated." once

`latest.judgedHere` is true only while this boot is the one that judged the intent, so a banner that thanks the user does it once. The boots after it read the same record with the outcome already in it, and say `false`. It lives in memory and adds nothing to the record, and like the outcome it says which boot judged, never that anything was installed.

```ts
const { latest } = beacon.transitions.get();

if (latest?.judgedHere && latest.outcome === "target-running") {
  console.info("Updated.");
}
```

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

## Advanced: the budget and the retention

Two options are for an application that reads `exhausted`, or that must keep intents for another time than a day. Leave them out otherwise.

| Option      | Default            | Meaning                                                                 |
| ----------- | ------------------ | ----------------------------------------------------------------------- |
| `budget`    | 3                  | how many boots in a row may leave a target unreached before `exhausted` |
| `retention` | 86,400,000 (a day) | milliseconds an intent is kept                                          |

A budget that is not a positive whole number, and a retention that is not a positive whole number of milliseconds, are refused with `INVALID_CONFIGURATION` when the Beacon is made.

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

## Limits

- Two tabs, or two runtimes, share no atomic counter. The last write wins and is what a later boot reads. `browserStorage()` keeps one tab's record apart from the others by default.
- A corrupt record, and a record of a future schema, are ignored with a diagnostic and never executed.
- Storage that lies about a write defeats a `required` journal, unless the record is read back, which `keyValueJournalStorage` does unless told not to. Neither mode proves storage survives a device failure or tampering.
- A page restored from the back-forward cache is the same boot. See [browser](browser.md#a-page-restored-from-the-back-forward-cache).

When the scope is replaced, the intents of the scope that ended are forgotten in memory and the next session reads the record of the next scope. See [scopes](scopes.md).

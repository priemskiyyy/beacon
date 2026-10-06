---
description: "Turn on the transition journal to learn on the next boot what a reload led to: intents, storage, checkpoints, boot reconciliation and the attempt budget."
---

# Journal

A reload replaces the code that asked for it. The new boot has to find out for itself whether the reload reached its target. The journal is how it does: Beacon writes an intent before a command that replaces the realm, and the next boot reads it back and compares it with what now runs.

It is off by default. Without it, `beacon.transitions` says so, and nothing is correlated across boots.

## Turn it on

The journal keeps its record in storage you provide, as strings under keys. You adapt whatever you have.

```ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type { JournalStorage } from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";
import { http, readStandardManifest } from "@priemskiyyy/beacon-http";
import type { RouteDeclarations } from "@priemskiyyy/beacon-http";

declare const __BUILD_ID__: string;

const storage: JournalStorage = {
  read: async (key) => localStorage.getItem(key),
  write: async (key, value) => localStorage.setItem(key, value),
  remove: async (key) => localStorage.removeItem(key),
};

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
    boot: { id: crypto.randomUUID() },
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

In React Native, adapt the key-value store you already use:

```ts
import type { JournalStorage } from "@priemskiyyy/beacon";

type KeyValueStore = {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

export const createJournalStorage = (store: KeyValueStore): JournalStorage => ({
  read: (key) => store.getItem(key),
  write: (key, value) => store.setItem(key, value),
  remove: (key) => store.removeItem(key),
});
```

A write that resolves must mean the value was persisted, not merely queued. A `required` journal treats anything else as a failure.

| Option      | Default            | Meaning                                                                 |
| ----------- | ------------------ | ----------------------------------------------------------------------- |
| `mode`      |                    | `best-effort` goes on when a write fails. `required` stops the command  |
| `storage`   |                    | your `read`, `write` and `remove`                                       |
| `budget`    | 3                  | how many boots in a row may leave a target unreached before `exhausted` |
| `retention` | 86,400,000 (a day) | milliseconds an intent is kept                                          |

A budget that is not a positive whole number, and a retention that is not a positive whole number of milliseconds, are refused with `INVALID_CONFIGURATION` when the Beacon is made.

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

## Limits

- Two tabs, or two runtimes, share no atomic counter. The last write wins and is what a later boot reads.
- A corrupt record, and a record of a future schema, are ignored with a diagnostic and never executed.
- Storage that lies about a write defeats a `required` journal. Neither mode proves storage survives a device failure or tampering.
- A page restored from the back-forward cache is the same boot. See [browser](browser.md#a-page-restored-from-the-back-forward-cache).

When the scope is replaced, the intents of the scope that ended are forgotten in memory and the next session reads the record of the next scope. See [scopes](scopes.md).

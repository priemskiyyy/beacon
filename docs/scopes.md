---
description: "The ReleaseScope a Beacon speaks for, partitions for accounts, and what replaceScope forgets, keeps and refuses."
---

# Scopes

A Beacon speaks for one scope: an application, in an environment, on a platform, through a distribution. Every source read, every cache and every journal record belongs to exactly one scope.

```ts
import type { ReleaseScope } from "@priemskiyyy/beacon";

export const scope: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
  partition: "user-42",
};
```

| Field          | Meaning                                                                                              |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| `application`  | the application, such as its bundle or package id; the Play adapter reads its Android id here        |
| `environment`  | `production`, `staging` and so on; a manifest for another environment is refused                     |
| `platform`     | `web`, `ios`, `android`                                                                              |
| `distribution` | the channel: `public-web`, `app-store`, `google-play`. The App Store adapter serves only `app-store` |
| `partition`    | optional; names the account when the answers differ by account                                       |

The values are yours. Beacon compares them and does not interpret them, except where an adapter says so.

## Partitions

When the answers differ by account, `partition` names the account as opaque text. No source keeps, renews or compares one account's answer for another. The [HTTP adapter](http.md) keeps a validator and a document only for the scope they were read for, and the [journal](journal.md) puts the partition in its key.

Put no token in it. It reaches your client only as part of the scope, and it is not a place for a secret. A manifest never states a partition: the standard manifest repeats the other four fields and leaves this one to the client.

## Replacing the scope

When the account or the environment changes without a new page load, put the next scope in force all at once.

```ts
export const switchAccount = (userId: string) => {
  const replacement = beacon.replaceScope({ ...scope, partition: userId });

  if (replacement.status === "blocked") {
    console.warn(`Acknowledge the operation on ${replacement.route} first.`);
  }

  return replacement.status;
};
```

| Result      | Means                                                                                     |
| ----------- | ----------------------------------------------------------------------------------------- |
| `replaced`  | the next scope is in force and everything the last one taught was forgotten               |
| `unchanged` | the scope equals the current one, and nothing was touched                                 |
| `blocked`   | a route has an operation running or unresolved, and the old scope stays entirely in force |

`blocked` names the route. The underlying work cannot be given to another scope, so finish it, or acknowledge it with `route.acknowledge()`, and call again. Stopping the session does not free an operation for another scope.

After `dispose()`, `replaceScope` throws `DISPOSED`.

### What it forgets

- The documents each source accepted, and the revision high-water marks that came with them. Another scope's evidence is never compared with this one's.
- Every observation, the offers and the references to them, and what a provider prepared.
- The support evaluated from those documents.
- The intents of the journal held in memory. An intent still queued for writing is never written under the next scope's key, and the next session reads the record of the next scope.
- The results of the old scope's reads. A read still under way is fenced, and a late answer changes nothing and is counted.

### What it keeps

- The routes, mechanisms and drivers, and every subscription to an observable.
- What is running. The scope never rewrites a running fact: a new environment label does not change the build in memory.

If a session is open, it ends and a new one starts with the next scope, under the same stop that `start()` answered. The status passes through `stopped` and back to `running`, and the session number grows. The running readers are read again, as for any new session.

## Scope checks in adapters

- `http` with the standard manifest refuses a manifest whose `application`, `environment`, `platform` or `distribution` differ from the scope's.
- `appStoreLookup` makes no request and answers "no release" for a scope whose `distribution` is not `app-store`.
- `googlePlay` uses `scope.application` as the Android application id.
- The conformance suite `testReleaseSource` takes the scope a source speaks for.

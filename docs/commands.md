---
description: "Call the typed command methods of a route, tell offers from prepared references, and handle every status a command settles as, exhaustively."
---

# Commands

A route gets one method per command its mechanism or driver declares. The method, its reference, its parameters and its receipt are derived from that declaration, so a wrong call does not compile.

```ts
const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  const outcome = await beacon
    .route("web")
    .reload({ offer: observation.offer });

  console.info(outcome.status);
}
```

There is no universal `install` or `apply`, and no `updated: true`. A method promises no more than its receipt does: `reload()` is answered with `reload-requested`.

## The verbs

The adapters share one vocabulary.

| Command     | Meaning                                                 |
| ----------- | ------------------------------------------------------- |
| `reload`    | replace the document, or restart the JavaScript runtime |
| `activate`  | ask a waiting service worker to take over               |
| `download`  | ask the provider to prepare an update                   |
| `update`    | start Play's immediate, blocking flow                   |
| `restart`   | ask Play to complete a downloaded update                |
| `openStore` | open the store page                                     |

A command cannot be named `state`, `native`, `capabilities`, `check` or `acknowledge`, and its parameters cannot be named `offer`, `prepared` or `signal`. The route handle is the command facade plus its own members, and a collision would silently overload one of them, so the types refuse it.

## What a call takes

The reference a command declares decides its argument.

| Declared reference | The call takes                            |
| ------------------ | ----------------------------------------- |
| `offer`            | `{ offer }`, this route's current offer   |
| `prepared`         | `{ prepared }`, what the provider readied |
| `optional-offer`   | an optional `{ offer }`                   |
| `none`             | an optional input                         |

Every call may also carry its command's parameters and a `signal`. A command that declares no parameters and needs no reference can be called with no argument.

Pass the offer or the prepared target itself, as the state gave it. Beacon reads the reference inside it, `offer.ref`, so `{ offer: offer.ref }` works too. Either way only what Beacon minted is believed: a copy of a reference, a forged one and one of another route are each refused, before anything is reserved.

The types refuse what they can see. An offer or a reference of another route does not fit, and neither does one of another kind.

```ts
import { Beacon } from "@priemskiyyy/beacon";
import { expoUpdates } from "@priemskiyyy/beacon-expo";
import { googlePlay } from "@priemskiyyy/beacon-google-play";
import type { PlayBridge } from "@priemskiyyy/beacon-google-play";
import * as Updates from "expo-updates";

declare const bridge: PlayBridge;

const native = new Beacon({
  scope: {
    application: "com.example.notes",
    environment: "production",
    platform: "android",
    distribution: "google-play",
  },
  routes: {
    ota: expoUpdates({ updates: Updates }),
    binary: googlePlay({ bridge }),
  },
});

const ota = native.route("ota");
const binary = native.route("binary").state.get().observation;
const { prepared } = ota.state.get();

if (binary.status === "available") {
  const foreign = binary.offer;

  // @ts-expect-error The offer belongs to the "binary" route.
  await ota.download({ offer: foreign });
}

if (prepared.status === "ready") {
  const readied = prepared.value;

  // @ts-expect-error A prepared target is not an offer.
  await ota.download({ offer: readied });
}
```

## Offers and prepared references

An **offer** is the route's current interpretation of what an authority or provider says is available. A feed route's offer comes from selection. A driver's offer comes from its check. It is not a downloaded thing and not a running fact.

A **prepared** target is what a provider reports as ready for a later step: a bundle it downloaded, a worker that took over. Only the provider's confirmation makes something `ready`, never the fact that a command returned. A prepared reference is minted when the provider reports it, and an offer never fits where a prepared target is asked for.

A typical provider sequence is an offer, a command that prepares, and a command that uses what was prepared:

| Adapter        | Sequence                                                                                             |
| -------------- | ---------------------------------------------------------------------------------------------------- |
| Expo           | `download` with the offer, then `reload` with the prepared target                                    |
| CodePush       | `download` with the offer, then `reload` with the prepared target                                    |
| Google Play    | `download` with the offer, then `restart` with the prepared target, or `update` with the offer alone |
| Service worker | `activate` with the offer, then `reload` with the prepared target                                    |
| Browser        | `reload` with the offer                                                                              |
| App Store      | `openStore`, with an offer or without one                                                            |
| Google Play    | `openStore` of `playStore`, with an offer or without one                                             |

Every reference is checked twice: when the call arrives, and again immediately before the provider is asked. See [disruptions](disruptions.md).

## What each command declares

Read it before you act, to warn the user.

```ts
const { reference, impacts, binding } = beacon.route("web").capabilities.reload;

console.info(reference, impacts, binding);
```

An **impact** is what a command can do to the running application. Participants choose which ones they must settle for.

| Impact                       | Means                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `document-replacement`       | the current document is replaced by a navigation                   |
| `javascript-restart`         | the JavaScript runtime restarts                                    |
| `native-update-flow`         | a provider's own update UI or install takes over                   |
| `worker-takeover`            | a service worker starts controlling clients                        |
| `external-handoff`           | the user leaves for a store or another application                 |
| `may-activate-on-next-start` | preparing may make the provider select the result on a later start |

A **binding** is how tightly the command is tied to what the user was shown. It is never tighter than the provider allows.

| Binding               | Means                                                                           |
| --------------------- | ------------------------------------------------------------------------------- |
| `unpinned-navigation` | the next navigation receives whatever is deployed                               |
| `provider-current`    | the provider acts on its own current selection, which may differ from the offer |
| `exact-instance`      | the command is bound to one observed instance                                   |
| `store-destination`   | the command opens a store page, not a binary                                    |

The commands of the adapters:

| Adapter        | Command     | Needs          | Impacts                                    | Binding               | Receipt kind                                                 |
| -------------- | ----------- | -------------- | ------------------------------------------ | --------------------- | ------------------------------------------------------------ |
| Browser        | `reload`    | offer          | `document-replacement`                     | `unpinned-navigation` | `reload-requested`                                           |
| Service worker | `activate`  | offer          | `worker-takeover`                          | `exact-instance`      | `activation-requested`                                       |
| Service worker | `reload`    | prepared       | `document-replacement`                     | `provider-current`    | `reload-requested`                                           |
| Expo           | `download`  | offer          | `may-activate-on-next-start`               | `provider-current`    | `update-prepared`, `rollback-prepared`, `no-new-preparation` |
| Expo           | `reload`    | prepared       | `javascript-restart`                       | `provider-current`    | `reload-requested`                                           |
| CodePush       | `download`  | offer          | `may-activate-on-next-start`               | `exact-instance`      | `update-staged`                                              |
| CodePush       | `reload`    | prepared       | `javascript-restart`                       | `provider-current`    | `reload-requested`                                           |
| Google Play    | `download`  | offer          | `may-activate-on-next-start`               | `provider-current`    | `update-downloaded`                                          |
| Google Play    | `update`    | offer          | `native-update-flow`, `javascript-restart` | `provider-current`    | `immediate-flow-started`                                     |
| Google Play    | `restart`   | prepared       | `javascript-restart`                       | `provider-current`    | `completion-requested`                                       |
| App Store      | `openStore` | optional offer | `external-handoff`                         | `store-destination`   | `store-handoff-requested`                                    |
| Google Play    | `openStore` | optional offer | `external-handoff`                         | `store-destination`   | `store-handoff-requested`                                    |

## Handling every status

A command never rejects. It settles as one of seven statuses, and the union is closed, so the compiler can prove you handled all of them.

```ts
import type { CommandOutcome } from "@priemskiyyy/beacon";
import type { BrowserReloadReceipt } from "@priemskiyyy/beacon-browser";

const assertNever = (value: never): never => {
  throw new Error(`Unhandled outcome: ${JSON.stringify(value)}`);
};

export const explain = (
  outcome: CommandOutcome<BrowserReloadReceipt>,
): string => {
  if (outcome.status === "accepted") {
    return `Reload requested, operation ${outcome.operation.id}.`;
  }

  if (outcome.status === "blocked") {
    const codes = outcome.reasons.map((reason) => reason.code);

    return `Not now: ${codes.join(", ")}.`;
  }

  if (outcome.status === "stale") {
    return `That update changed (${outcome.reason}). Check again.`;
  }

  if (outcome.status === "unsupported") {
    return `This device cannot do that (${outcome.reason}).`;
  }

  if (outcome.status === "cancelled") {
    return `Stopped at ${outcome.stage}.`;
  }

  if (outcome.status === "failed") {
    return `It failed (${outcome.error.code}).`;
  }

  if (outcome.status === "indeterminate") {
    return `It may have started (${outcome.reason}).`;
  }

  return assertNever(outcome);
};
```

If Beacon adds a status, `assertNever(outcome)` stops compiling and tells you where.

| Status          | Carries                | What to do                                                                                   |
| --------------- | ---------------------- | -------------------------------------------------------------------------------------------- |
| `accepted`      | `operation`, `receipt` | Say what the receipt says, and no more. Read the state again for what the provider prepared. |
| `blocked`       | `reasons`              | Show the participant's own reason. Do not retry in a loop. See below.                        |
| `stale`         | `reason`               | The reference is no longer good. Check again and read the new offer.                         |
| `unsupported`   | `reason`               | Hide the action. The reasons are the adapter's, such as `no-document` or `updates-disabled`. |
| `cancelled`     | `stage`                | Nothing took effect. The stage says where it stopped.                                        |
| `failed`        | `error`                | Nothing took effect. Branch on `error.code`, such as `COMMAND_FAILED` or `JOURNAL_FAILED`.   |
| `indeterminate` | `operation`, `reason`  | It may have taken effect. Never retry blindly. Read the route state, then acknowledge.       |

### Blocked

Each reason is `{ code, participant }`, where `participant` is `{ name }` for a participant of yours and `null` when Beacon itself refused.

| Code                              | Raised by     | Means                                                                                        |
| --------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| `operation-in-progress`           | Beacon        | another command holds this route, or the one disruptive slot                                 |
| `operation-indeterminate`         | Beacon        | the route's last command may have taken effect and was not confirmed                         |
| `safety-changed`                  | Beacon        | a participant registered or left while the command was settling                              |
| `reservation-failed`              | Beacon        | a participant threw or answered nothing usable when asked to reserve                         |
| `settlement-timeout`              | Beacon        | a participant did not settle within `timeouts.settlement`                                    |
| `settlement-failed`               | Beacon        | a participant threw or rejected while settling, or the host clock could not arm its deadline |
| your own, such as `unsaved-draft` | a participant | the participant refused                                                                      |

A blocked command is never queued. Deferring is your job: keep the offer, tell the user, and call again when the block clears.

### Cancelled stages

`before-dispatch`, `settling` and `journaling` come from Beacon: the caller's `signal` or the end of the session stopped the call before the provider was asked. `joined` means a caller that joined a running command stopped waiting for it. `consent`, `download` and `session-ended` come from a provider: the user declined the prompt, the download was cancelled, or the session ended.

### Failed

`COMMAND_FAILED` is a provider command that threw or answered something that is not a result, or a call that could not be carried out, so it did not take effect. `DRIVER_FAILED` says the provider is not open. `NOT_STARTED` and `DISPOSED` say there is no session to run in. `JOURNAL_FAILED` says a required journal could not persist the intent, so the provider was never asked.

## Sharing a route

A route runs one operation at a time, and one disruptive operation runs across all routes.

- An **identical call** joins the operation under way and settles with the same outcome. A guard that repeats the call it guards therefore dispatches once.
- A **different call** while one runs is `blocked` with `operation-in-progress`. It is never queued.
- A command that replaces the realm, meaning `document-replacement` or `javascript-restart`, leaves its route unresolved after it is accepted, with the operation `indeterminate` and the reason `dispatch-unconfirmed`. The old realm may stay alive. Its reservations are kept, and the next command is `blocked` with `operation-indeterminate`. Call `route.acknowledge()` once the application decides to continue in this runtime.

## Aborting

Pass a `signal` to end your wait.

```ts
const { observation } = beacon.route("web").state.get();

if (observation.status === "available") {
  const controller = new AbortController();

  const pending = beacon.route("web").reload({
    offer: observation.offer,
    signal: controller.signal,
  });

  controller.abort();

  console.info((await pending).status);
}
```

Before the provider is asked, an abort settles as `cancelled`, releases every reservation and asks nobody. After the provider was asked, it settles as `indeterminate` with the reason `aborted-after-dispatch`, never as `cancelled`: an abort ends a wait, and is never proof that the provider stopped. A later provider result still releases or holds the route as it reports.

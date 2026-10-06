---
description: "Write your own release source, update mechanism or release driver with createReleaseSource, createUpdateMechanism and createReleaseDriver, and prove it with the conformance suites."
---

# Custom adapters

An adapter maps one provider onto observations, prepared targets and command results, and nothing more. Beacon offers three shapes, and the shape follows who owns the question.

| You have                                                      | Make it with            | It gives                                    |
| ------------------------------------------------------------- | ----------------------- | ------------------------------------------- |
| an authority you read, such as your own release API           | `createReleaseSource`   | a source, for `targetRoute` or `newerRoute` |
| a platform action for an offer someone else's source produced | `createUpdateMechanism` | commands for a feed route                   |
| a provider that checks, prepares and acts, all on its own     | `createReleaseDriver`   | a whole route, ready for `routes`           |

The core never branches on an adapter's name. A source and a mechanism are separate on purpose: what an authority says and how the platform acts on it change independently.

## Rules

These are the rules that are easiest to break.

- **The factory is cold.** Nothing is read, subscribed or registered until a session opens, and a host without the provider is inert, never an error.
- **Take the SDK the application set up, never configure it.** The application passes the SDK in, and its type is structural, so your package imports no SDK, no `react-native` and no test runner.
- **Remove only what you added.** Take back only the listeners you attached, since the provider is borrowed.
- **Never claim more than the provider gave.** A command's receipt names what was accepted. Nothing it returns changes what is running.
- **A native handle is an object.** `null` means the route is not open, so a handle that could be `null` would be ambiguous. Type errors say so.
- **Never throw into the host from a callback.** Return a status, or reject where the type says a source or a check rejects.
- **Look at the signal right before an irreversible dispatch.** After the last `await` and in the same run as the provider call, check `signal.aborted`, and answer `cancelled` with the stage `session-ended` so that nothing is started for a wait that has ended.
- **Reach a driver's private state through `native`.** A command receives only the `native` handle of the session that dispatched it, so what the session keeps for its commands, such as its emitter or a package it found, sits in a table keyed by that handle and goes when the session is disposed.
- **What the provider did not give is `unknown`.** `null`, `undefined`, `NaN`, an empty text or a sentinel such as `"unknown"` becomes an unknown identity with a named reason, or an `unknown` observation, and never a known identity whose text is `"undefined"`.

## A source

`createReleaseSource({ name, read })` is covered in [routes](routes.md#sources). It answers a validated document, or rejects. Keep one source per authority, so that every route and the support policy share its read.

## A mechanism

A mechanism carries commands for a route whose offers come from a source, and names the running subject its commands replace, so the route compares what the source offers with that subject's running fact: a reload of the document is `web`, a store page is `native`, a relaunch of the JavaScript is `bundle`. This one asks the host to relaunch, and the host is looked up lazily, so opening a session is the first time it is touched. `open` is given the scope the session runs under, as `open: ({ scope }) => ...`, for a mechanism whose commands depend on it, such as a store handoff that only answers for its own distribution.

```ts
// src/relaunch.ts
import { createUpdateMechanism } from "@priemskiyyy/beacon/adapter";
import type { ProviderResult } from "@priemskiyyy/beacon/adapter";

export type Launcher = { relaunch(): void };

export type RelaunchReceipt = { kind: "relaunch-requested" };

export const relaunch = (getLauncher: () => Launcher | null) =>
  createUpdateMechanism({
    name: "relaunch",
    subject: "bundle",
    open: () => ({ native: { launcher: getLauncher() } }),
    commands: {
      relaunch: {
        reference: "offer",
        impacts: ["javascript-restart"],
        binding: "provider-current",
        run: async ({ native }): Promise<ProviderResult<RelaunchReceipt>> => {
          if (native.launcher === null) {
            return { status: "unsupported", reason: "no-launcher" };
          }

          native.launcher.relaunch();

          return {
            status: "accepted",
            receipt: { kind: "relaunch-requested" },
          };
        },
      },
    },
  });
```

A command declares four things, before it can be called:

| Field       | Says                                                                                                                    |
| ----------- | ----------------------------------------------------------------------------------------------------------------------- |
| `reference` | `offer`, `prepared`, `optional-offer` or `none`: which reference the caller must bring                                  |
| `impacts`   | what it can do to the running application, so participants are asked only about what it does                            |
| `binding`   | how tightly it is bound to what the user was shown, never tighter than the provider allows                              |
| `run`       | dispatches once, receives `native`, a `signal`, the `parameters` and the reference, and reports the provider's evidence |

`run` answers a `ProviderResult`: `accepted` with a receipt that names what was accepted, `stale`, `unsupported` with a reason, `cancelled` with a stage, `failed` with an error, or `indeterminate`. A `run` that throws is a `failed` with `COMMAND_FAILED`, and one that may have taken effect says `indeterminate`. The receipt is never a bare "updated".

The types derive the route's method from the declaration. A route made with this mechanism has `route.relaunch({ offer })`, and its receipt type is `RelaunchReceipt`. A command whose `run` promised an offer cannot be called without one. Annotate what `run` returns, as above: without `Promise<ProviderResult<RelaunchReceipt>>` TypeScript widens the receipt's `kind` to `string`, and the caller can no longer tell receipts apart.

### Names that are taken

A command cannot be named `state`, `native`, `capabilities`, `check` or `acknowledge`, and its parameters cannot be named `offer`, `prepared` or `signal`. The route handle is the command facade plus its own members, so a collision would silently overload one of them. The types refuse it.

```ts
import { createUpdateMechanism } from "@priemskiyyy/beacon/adapter";

export const clash = createUpdateMechanism({
  name: "clash",
  subject: "bundle",
  open: () => ({ native: {} }),
  commands: {
    // @ts-expect-error A command cannot be named "state".
    state: {
      reference: "none",
      impacts: [],
      binding: "provider-current",
      run: async () => ({
        status: "accepted",
        receipt: { kind: "never" },
      }),
    },
  },
});
```

A command that needs parameters declares them in its `run` context, for example `run: async ({ native, parameters }: CommandRunContext<Native, { flow: Flow }>)`, and the route method requires them.

## A driver

A driver owns the check, the prepared targets and the commands of one provider. This one wraps an over-the-air SDK. It is small on purpose.

```ts
// src/otaDriver.ts
import { createReleaseDriver } from "@priemskiyyy/beacon/adapter";
import type { RouteBody } from "@priemskiyyy/beacon";
import type { CommandMap, ProviderResult } from "@priemskiyyy/beacon/adapter";

type OtaSdk = {
  latest(): Promise<{ id: string } | null>;
  download(id: string): Promise<void>;
  onDownloaded(listener: (id: string) => void): () => void;
  restart(): Promise<void>;
};

type OtaNative = { sdk: OtaSdk };

type DownloadReceipt = { kind: "download-finished" };

const commands = {
  download: {
    reference: "offer",
    impacts: ["may-activate-on-next-start"],
    binding: "provider-current",
    run: async ({
      native,
      offer,
    }): Promise<ProviderResult<DownloadReceipt>> => {
      const { identity } = offer.release;

      if (identity.status !== "known") {
        return { status: "stale" };
      }

      await native.sdk.download(identity.value);

      return { status: "accepted", receipt: { kind: "download-finished" } };
    },
  },
  restart: {
    reference: "prepared",
    impacts: ["javascript-restart"],
    binding: "provider-current",
    run: async ({
      native,
    }): Promise<ProviderResult<{ kind: "restart-requested" }>> => {
      await native.sdk.restart();

      return { status: "accepted", receipt: { kind: "restart-requested" } };
    },
  },
} satisfies CommandMap<OtaNative, RouteBody, RouteBody>;

const release = (id: string): RouteBody["release"] => ({
  identity: {
    status: "known",
    authority: "ota-sdk",
    domain: "bundle",
    value: id,
  },
});

export const otaDriver = (sdk: OtaSdk) =>
  createReleaseDriver<OtaNative, RouteBody, RouteBody, typeof commands>({
    name: "ota-sdk",
    subject: "bundle",
    prepares: true,
    // One session at a time may hold the SDK.
    exclusive: sdk,
    open: ({ emit }) => {
      const stop = sdk.onDownloaded((id) => {
        emit.prepared({ status: "ready", value: { release: release(id) } });
      });

      return {
        native: { sdk },
        check: async () => {
          const latest = await sdk.latest();

          if (latest === null) {
            return {
              status: "none",
              reason: "no-decision",
              detail: "up-to-date",
            };
          }

          return {
            status: "available",
            offer: { release: release(latest.id) },
          };
        },
        dispose: stop,
      };
    },
    commands,
  });
```

The pieces, in the order a session uses them:

- **`name`** labels evidence and diagnostics. **`subject`** is the running subject this provider replaces, so an intent can be read back against it. **`prepares`** says whether the provider can report a prepared target at all. A route that does not prepare has `prepared` as `not-applicable`. One that does starts at `unknown`.
- **`running`** is optional: the local reader of what its subject runs, such as the update the bundle was made from. Beacon uses it only when the application passes no reader for that subject in `running`, so there is still one reader per subject, and the application's always wins. It is a reader like any other, given `{ scope }`: it reads what the provider's own module says is running, and the driver writes no fact. Two drivers that supply one subject need the application to choose, and Beacon throws `INVALID_CONFIGURATION` until it does.
- **`exclusive`** names the native manager the provider must have to itself. A second session that would open the same manager fails to open, and its route says `DRIVER_FAILED`, instead of racing the first.
- **`open(context)`** runs when a session starts. The context has the `scope`, a read-only view of what is running and the emitter. It cannot write running facts. It returns the session: `native`, the `check`, an optional `reconcile` and an optional `dispose`.
- **`check({ signal })`** asks the provider and answers an `ObservationDraft`: `unknown` (the provider cannot run here), `none` or `available`. A driver compares nothing with what runs, so it never reports an inconclusive selection. Beacon attaches the evidence and mints the reference, so a driver cannot claim a reference it was never given.
- **`reconcile({ signal })`** reads the provider's current local state once, as a session opens, and reports it through the emitter. A report Beacon cannot take (a malformed payload, a `prepared` report from a driver that declared `prepares: false`) is dropped and recorded as a `route-failed` event, and a progress outside 0 to 1 is published as `null`.
- **The emitter** reports what the provider says between checks: `emit.observation(draft)`, `emit.prepared({ status: "ready", value })` or `emit.prepared({ status: "none" })`, and `emit.progress(fraction)` with a fraction between 0 and 1, or `null`. It is fenced by the session: after the session ends, a call is counted and dropped.
- **`dispose`** removes what the driver added, and only that. Beacon gives the exclusive manager back even when `dispose` throws.

Only a confirmation from the provider may say `ready`. A command that returned is not one.

## Prove it

The conformance suites of `@priemskiyyy/beacon/testing` register the contract every adapter keeps, over a fake of the provider. They need `vitest`. Call them at the top level of `src/conformance.test.ts`.

| Suite                 | Contract                                                                                                                                                                                                                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `testReleaseSource`   | it has a name, asks its backend for nothing until read, answers a document with real times and non-empty identifiers, can be read again, and every projection of it belongs to it                                                                                                                 |
| `testVersionStrategy` | an input compares equal to itself, `newer` and `older` mirror each other along the ascending inputs, and a value that breaks the grammar throws                                                                                                                                                   |
| `testUpdateMechanism` | it names the running subject its commands replace, opens nothing and holds nothing until a session opens, can be opened again after it ended, and ending a session releases what it held                                                                                                          |
| `testReleaseDriver`   | it declares valid commands, opens with a native handle and a check that answers a valid observation, prepares only if it said it does, holds no listener once disposed, and reports nothing after that                                                                                            |
| `testRunningReader`   | it asks its host for nothing until read, answers a release whose identity has no empty part or space around it, answers the same release on every read, reads under the frozen scope it is given, and answers an unknown identity or rejects where the host cannot name what runs, never throwing |
| `testJournalStorage`  | a key nothing was written under reads `null`, a write can be read back and overwrites, a remove deletes and never throws, text and kilobyte records come back exactly, and a reopened storage keeps what it was given                                                                             |

```ts
import { testUpdateMechanism } from "@priemskiyyy/beacon/testing";

import { relaunch } from "src/relaunch";

testUpdateMechanism({
  name: "relaunch",
  create: () => ({ mechanism: relaunch(() => ({ relaunch: () => {} })) }),
});
```

The suite counts the mechanism's own `open` calls. If the fake platform can say what the mechanism holds on it, such as its listeners, return `held: () => listeners.size` beside the mechanism, and the suite checks that nothing is held before a session opens and that ending one releases what it held.

For a driver, hand the suite the route over a fake SDK, and the fake's way of reporting a change and counting listeners:

```ts
import { testReleaseDriver } from "@priemskiyyy/beacon/testing";

import { otaDriver } from "src/otaDriver";

testReleaseDriver({
  name: "ota-sdk",
  create: () => {
    const listeners = new Set<(id: string) => void>();

    const route = otaDriver({
      latest: async () => null,
      download: async () => {},
      restart: async () => {},
      onDownloaded: (listener) => {
        listeners.add(listener);

        return () => {
          listeners.delete(listener);
        };
      },
    });

    return {
      route,
      provider: {
        update: () => {
          for (const listener of listeners) {
            listener("bundle-2");
          }
        },
        listeners: () => listeners.size,
      },
    };
  },
});
```

The suites cannot check that the fake behaves like the real SDK, or that a command does what its receipt claims. Keep those in your own tests, and validate the flow on a real device. Test with the [test clock and mock source](testing.md), never with a sleep.

Also prove the real SDK's types fit in a `*.contracts.ts` file that is typechecked and never run, so that an SDK release that breaks the structural type fails your build.

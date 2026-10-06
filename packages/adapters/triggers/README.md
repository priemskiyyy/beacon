# @priemskiyyy/beacon-triggers

Checks a [Beacon](../../core) on the moments an app needs it: when it starts, when it returns from the background, when the network comes back, now and then, and when a push says so. React Native first, with `AppState` and NetInfo as they are; React on the web through the sources you already have. One gate behind every trigger shares reads, holds a burst to one start, backs off after a failure and stops when you say so. Beacon itself has no timer and no subscription, and nothing here is subscribed before you call `checkOn`.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-triggers
```

It imports no SDK: you pass `AppState`, NetInfo or a Pulse in, and their types are structural, so a test passes a fake and a server render loads nothing. `@react-native-community/netinfo` is yours to install if you use `reconnect`.

## Use it in React Native

```tsx
import {
  checkOn,
  foreground,
  interval,
  reconnect,
  startup,
} from "@priemskiyyy/beacon-triggers";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

export const useUpdateChecks = () => {
  useEffect(
    () =>
      checkOn(beacon, {
        triggers: [
          startup(),
          foreground({ appState: AppState, minAway: 30_000 }),
          reconnect({ netInfo: NetInfo }),
          interval({ every: 30 * 60_000, jitter: 0.2 }),
        ],
        backoff: { first: 10_000, max: 15 * 60_000 },
      }),
    [],
  );
};
```

`checkOn` answers its stop, which is what `useEffect` wants as a cleanup, and it is safe under Strict Mode: the effect runs, stops and runs again, and one set of listeners is left. Call the hook below `BeaconProvider`, which starts the session: a trigger is installed when the session opens, whichever came first. [React Native](../../../docs/react-native.md#when-to-check) has the wiring of the whole app.

## What each trigger subscribes to

`checkOn` itself subscribes to the Beacon's `status` and to nothing else. Nothing is subscribed or armed before you call it, and a session that is not open has none of it: each time a session opens, the triggers are installed, and each time it ends, they are taken back.

| Trigger                                 | Subscribes to                                  | Checks when                                                          | Reason         |
| --------------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------- | -------------- |
| `startup()`                             | nothing                                        | a session opens, and again for the session `replaceScope` starts     | `startup`      |
| `foreground({ appState, minAway? })`    | `AppState`'s `change` event, one listener      | the app comes back after a trip through `background`                 | `foreground`   |
| `pulseForeground({ source, minAway? })` | a Pulse's `foreground` and `background` events | the Pulse says the app returned                                      | `foreground`   |
| `reconnect({ netInfo })`                | NetInfo's state, one listener                  | an observed change from not connected to connected, never at startup | `reconnect`    |
| `reachReconnect({ condition })`         | a Reach condition                              | it goes from unmet to met                                            | `reconnect`    |
| `interval({ every, jitter? })`          | nothing: one timer on the Beacon's clock       | `every` milliseconds after the last check the gate started settled   | `interval`     |
| `invalidation({ source })`              | anything with `subscribe(listener)`            | it says so; its payload is never read                                | `invalidation` |

The options add two more: `onExpiry` subscribes to each route's state, and a backoff arms one timer while it waits. The reasons are the core's `CheckReason`; a retry and an expiry are labelled `interval`, since the core has no label for them.

### The return from the background

React Native's `AppState` is not a return signal by itself. On iOS a system dialog, the control center or an incoming call takes the app from `active` to `inactive` and back, and on Android every pause of the activity is a `background`. `foreground` keeps the rule, so your code need not: only a trip through `background` is a return, `inactive` and back checks nothing, and an app that starts in the background checks when it first becomes `active`. With `minAway`, a return after less than that many milliseconds is skipped, and one whose departure was not seen never is.

### A Pulse and a Reach condition

A Pulse satisfies `ForegroundSourceLike` and a Reach condition satisfies `ConditionLike`, on the web and in React Native alike:

```ts
import { checkOn, pulseForeground } from "@priemskiyyy/beacon-triggers";
import type { Pulse } from "@priemskiyyy/pulse";

declare const pulse: Pulse;

export const stop = checkOn(beacon, {
  triggers: [pulseForeground({ source: pulse, minAway: 30_000 })],
});
```

Start the Pulse yourself: a Pulse that was never started says nothing. A source of your own that only says "look again" goes through `invalidation`, and one that needs another reason is a trigger of its own: `(target) => stop`, which offers `target.signal(reason)`.

## The gate

Every trigger only offers a reason. One gate, made anew for each session, decides whether and when a check starts:

| Situation                                            | What the gate does                                                                                                       |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| signals of one moment                                | one read: a signal during the check it started is answered by it                                                         |
| a signal within `minInterval` of the last start      | waits, and the signals that wait become one start when it ends                                                           |
| a `reconnect`                                        | `after-current`: a read that began before it cannot answer it, so the check begins after                                 |
| a failed check                                       | with a `backoff`, waits `first`, then twice as long for each failure up to `max`, and retries by itself `attempts` times |
| a `reconnect` during that wait                       | checks at once, since the network coming back is the reason the failure may be over                                      |
| a check that succeeded                               | the failure count starts again                                                                                           |
| the app in the background                            | `interval` pauses and waits its full delay again after the return                                                        |
| `whileFresh: "skip"`                                 | a `foreground` or `interval` signal is dropped while every route holds fresh evidence that can expire                    |
| the authority's `expiresAt` passing, with `onExpiry` | one check, heard through the route state, with no timer of the gate's own                                                |
| the session ending, or `replaceScope`                | the gate and everything it held goes; the next session starts with no failure counted                                    |

## Options

| Option        | Default       | Means                                                                                                                                                                  |
| ------------- | ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `triggers`    | required      | the moments to check on                                                                                                                                                |
| `minInterval` | `5_000`       | the least time between two starts                                                                                                                                      |
| `backoff`     | `false`       | `{ first, max, jitter?, attempts? }`: the wait after a failure, doubled for each consecutive one, with `jitter` (0.2) of it added at random and `attempts` (3) retries |
| `whileFresh`  | `"check"`     | `"skip"` drops a `foreground` or `interval` signal while every route holds fresh evidence whose `expiresAt` is not `null`                                              |
| `onExpiry`    | `false`       | checks when a route's evidence goes from fresh to expired                                                                                                              |
| `random`      | `Math.random` | the source of the jitter                                                                                                                                               |

The clock is `beacon.clock`, so a test clock moves every timer of the gate. A trigger that throws on install costs only itself and its error reaches the host outside the call, as a listener's does in Beacon.

## What it does not do

- It makes no runtime run. A timer of a backgrounded app or tab may be throttled or never fire, so keep `foreground` beside `interval`.
- `observedAway` and the away time `foreground` measures are estimates, and they only throttle.
- A reconnect says the device is connected, not that the authority is reachable.
- The gate is per JavaScript runtime: N tabs are N gates and N reads.
- `Retry-After` is not read, and a failed check is a failed check. There is no `beacon.reconcile()` yet, so `foreground` only checks.
- It stores nothing: every launch checks at `startup`.

## Verification

| Claim                                                                                                                                                      | Proven by                                                                  | State          |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------- |
| Nothing is subscribed or armed before `checkOn`, `stop` leaves no listener and no timer, a session's end takes the triggers                                | scenarios over the real core, the test clock and fakes (`TRIG-01` to `08`) | tested         |
| One read per moment, a reconnect reads after the current one, a burst is one start, backoff, jitter, freshness, expiry and a clock that cannot arm a timer | the same, with the mock source (`TRIG-09` to `19`, `TRIG-30`)              | tested         |
| The return rule of `AppState`, `minAway`, NetInfo's first call, a condition, a push                                                                        | the same over fakes of each source (`TRIG-20` to `29`)                     | tested         |
| A Pulse's events and `observedAway` decide the check                                                                                                       | the real Pulse 0.1.0 over its own mock adapter (`TRIG-27`)                 | tested         |
| The real `AppState` of React Native 0.86.3, NetInfo 12.0.1 and Pulse 0.1.0 satisfy the structural types                                                    | `src/checkOn.contracts.ts`, typechecked                                    | tested         |
| A Reach 0.1.0 condition, React Native 0.87.1 and the strict API of 0.86.3 satisfy them                                                                     | typechecked once in a scratch directory: Reach 0.1.0 is unpublished        | not in CI      |
| `AppState` on a device: a system dialog taking iOS to `inactive` and back, every Android pause being `background`                                          | nothing                                                                    | **UNVERIFIED** |
| NetInfo on a device: its first call, its state across a real change of network                                                                             | nothing                                                                    | **UNVERIFIED** |
| Background timers: iOS suspending JavaScript, Android throttling it, a hidden tab throttling a timer                                                       | nothing                                                                    | **UNVERIFIED** |
| An `interval` that resumes at the return, and a check that is in flight when the app is suspended                                                          | nothing                                                                    | **UNVERIFIED** |
| The triggers under Hermes                                                                                                                                  | the same scenarios in the Hermes-like environment, not a device            | tested         |

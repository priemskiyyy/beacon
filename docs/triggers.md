---
description: "Check a Beacon at startup, on a return from the background or a tab shown again, a network that came back, an interval or a push with checkOn, in React Native and in the browser: what each trigger subscribes to, how one gate times, joins and backs off a check, and what it does not do."
---

# Triggers

Beacon has no timer and subscribes to nothing, so when to check is yours. `@priemskiyyy/beacon/triggers` is the part every application writes the same way: a check at startup, another when the app returns from the background or the network comes back, one now and then, and one when a push says so. Each moment is a trigger, and one gate behind them shares reads, holds a burst to one start, backs off after a failure and stops when you say so.

```sh
pnpm add @priemskiyyy/beacon
```

It is a subpath of the core package, so there is nothing else to install, and an app that never imports it bundles none of it. It imports no SDK. You pass React Native's `AppState`, NetInfo, a Pulse or a source of your own in, and what each needs of it is a structural type, so a test passes a fake and a server render loads nothing.

## React Native

```ts
// src/useChecks.native.ts
import {
  checkOn,
  foreground,
  interval,
  reconnect,
} from "@priemskiyyy/beacon/triggers";
import NetInfo from "@react-native-community/netinfo";
import { useEffect } from "react";
import { AppState } from "react-native";

export const useChecks = () => {
  useEffect(
    () =>
      checkOn(beacon, {
        triggers: [
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

`checkOn` checks once each time a session opens, with no trigger to list for it, and then on the moments its triggers name. `foreground` alone is the smallest useful set: `checkOn(beacon, { triggers: [foreground({ appState: AppState })] })`.

`checkOn` installs its triggers only while a session is open, and takes them back when it ends, so the order of the provider and the effect does not matter, and the hook may sit above the provider or below it. It answers its stop, which is what a `useEffect` wants back as a cleanup: under Strict Mode the effect runs, stops and runs again, and one set of listeners is left. Outside a component, such as a plain module, one call at module level does the same, and is never stopped. [React Native](react-native.md#when-to-check) has the wiring of the whole app, and `@react-native-community/netinfo` is yours to install if you use `reconnect`.

## On the web

The `@priemskiyyy/beacon/triggers/browser` subpath has the same two triggers over the page's own events, under the same names and with the same reasons, so nothing has to be written by hand:

```ts
// src/useChecks.web.ts
import { checkOn, interval } from "@priemskiyyy/beacon/triggers";
import { foreground, reconnect } from "@priemskiyyy/beacon/triggers/browser";
import { useEffect } from "react";

export const useChecks = () => {
  useEffect(
    () =>
      checkOn(beacon, {
        triggers: [foreground(), reconnect(), interval({ every: 10 * 60_000 })],
      }),
    [],
  );
};
```

`foreground({ target?, minAway? })` listens to the document's `visibilitychange` and the window's `pageshow`. A tab that is hidden and shown again is a return, a page the browser restores from the back-forward cache is one too, and a page that was never hidden is not. It also tells the gate where the page is, so `interval` pauses while the tab is hidden, where a browser throttles its timers, and waits its full delay again after the return. `reconnect({ target? })` listens to the window's `online` event, which fires only on a change, so a page that loads online is not a reconnect and nothing is checked at startup.

Both listen to the global `window`, reached when a session opens and never when the trigger is made, or to a `target` you pass, such as another frame's window or a fake in a test. Where there is no window, as in a server render, or where `window` is not a browser's, as React Native's global object is not, they install nothing and cost nothing. The `minAway` of `foreground` is the same throttle as in React Native. Safari, Firefox and the back-forward cache are not run against a real browser: see [what no device has run](#what-it-does-not-do).

## The triggers

`checkOn(beacon, { triggers })` subscribes to the Beacon's `status` and to nothing else. Nothing is subscribed or armed before you call it, and none of it while no session is open: each time a session opens, the triggers are installed, and each time it ends, they are taken back. Every trigger only offers a reason, and the gate decides.

| Trigger                                 | Subscribes to                             | Offers a check when                                                | Reason         |
| --------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------ | -------------- |
| `foreground({ appState, minAway? })`    | `AppState`'s `change` event, one listener | the app comes back after a trip through `background`               | `foreground`   |
| `foreground({ target?, minAway? })`     | `visibilitychange` and `pageshow`         | a hidden tab is shown, or the page comes back from the cache       | `foreground`   |
| `reconnect({ netInfo })`                | NetInfo's state, one listener             | NetInfo was seen not connected, and now is connected               | `reconnect`    |
| `reconnect({ target? })`                | the window's `online` event               | the browser says the network came back                             | `reconnect`    |
| `interval({ every, jitter? })`          | nothing: one timer on the Beacon's clock  | `every` milliseconds after the last check the gate started settled | `interval`     |
| `pulseForeground({ source, minAway? })` | a Pulse's `foreground` and `background`   | the Pulse says the app returned                                    | `foreground`   |
| `reachReconnect({ condition })`         | a Reach condition                         | the condition was unmet, and now is met                            | `reconnect`    |
| `invalidation({ source })`              | anything with `subscribe(listener)`       | it says so; its payload is never read                              | `invalidation` |

The first two pairs of rows are two imports: the React Native ones come from `@priemskiyyy/beacon/triggers` and the browser ones from `@priemskiyyy/beacon/triggers/browser`. The check at startup is not a trigger: each time a session opens, including the one `replaceScope` starts for a new scope, the gate checks once with the reason `startup`. Pass `startup: false` to `checkOn` where the first check belongs to something else. A check after a failure is labelled `retry`, and one because evidence expired `expiry`, so the diagnostics tell them from the timer's `interval`.

### foreground

React Native's `AppState` is not a return signal by itself, and the trap is in what it says:

- On iOS a system dialog, the control center or an incoming call takes the app from `active` to `inactive` and back. Only a trip through `background` is a return.
- On Android there is no `inactive`, and every pause of the activity is a `background`, a permission dialog included.

`foreground` keeps that rule, so your code does not. It remembers whether the app went to the background, and only the next `active` after that checks:

| `AppState` says                                 | `foreground` does                                            |
| ----------------------------------------------- | ------------------------------------------------------------ |
| `background`, then `active`                     | offers a check                                               |
| `background`, `inactive`, `active`              | offers one check: the iOS way back passes through `inactive` |
| `inactive`, then `active`                       | nothing: a dialog is not a trip                              |
| `active`, `inactive`, `active` after a return   | nothing more: the trip is over                               |
| `active` when the app started in the background | offers a check, since it is the first way back               |

With `minAway`, a return after less than that many milliseconds is skipped. The time is the Beacon's clock from the `background` report to the `active` one, so it is an estimate, and a return whose departure was not seen, such as the first `active` of an app that started in the background, is never skipped. It only throttles, and a skipped return still ends the absence.

### pulseForeground

A Pulse says the same thing with more care, on the web and in React Native. `pulseForeground({ source: pulse })` listens to its `foreground` event, which carries `observedAway`, and to `background`. With `minAway`, a return whose `observedAway` is lower is skipped, and `null`, which means the departure was not observed, never is. Start the Pulse yourself: one that was never started says nothing.

### reconnect and reachReconnect

NetInfo calls a new listener with the state it knows as soon as it subscribes, and then on every change. So `reconnect({ netInfo })` does not read "connected" as a reconnect: only an observed change from `isConnected: false` to `true` is one, nothing is checked at startup, and an unknown state (`null`) is neither a loss nor a return. An app that starts offline checks when the network first comes. The browser's `online` event only fires on a change, so `reconnect()` of the browser subpath keeps the same rule without looking at `navigator.onLine`.

`reachReconnect({ condition })` keeps the same rule over a Reach condition: it was `unmet`, and now it is `met`. A reconnect does not wait out a backoff, and its check begins after any read that was under way, since that read may have met the dead network. It says the device is connected, not that the authority is reachable.

### interval

`interval({ every, jitter })` arms one timer on the Beacon's clock. When a check the gate started settles, whichever trigger started it, the timer starts again from its full delay, so a return that just checked does not check again a moment later. `jitter` adds up to that share of the delay at random, so a fleet does not check in step. A tick that the gate drops or delays does not end the cadence. `every` is a positive whole number of milliseconds and `jitter` a finite number of at least zero, and `interval` throws `INVALID_CONFIGURATION` when it is made with anything else, since a delay that is none would arm the timer again at once, for ever. A delay beyond what a host timer holds is clamped to the longest it holds.

While a trigger says the app is in the background, which `foreground` and `pulseForeground` do and a trigger of your own can with `target.setAway(true)`, the timer is cancelled, and it waits its full delay again after the return. Without one, it never pauses.

### invalidation

`invalidation({ source })` takes anything that says "look again": a push channel, another tab, a value that changed. The source's payload is never read. What the authority says is what the check reads, so a push cannot offer a release the authority did not publish.

```ts
import { checkOn, invalidation } from "@priemskiyyy/beacon/triggers";
import type { Subscribable } from "@priemskiyyy/beacon/triggers";

declare const channel: Subscribable;

export const stop = checkOn(beacon, {
  triggers: [invalidation({ source: channel })],
});
```

### Write your own

A trigger is `(target) => stop`. It gets `target.signal(reason)` to offer a check, `target.clock` and `target.random`, and, when it knows where the app is, `target.setAway(away)`. A `setAway` or a settled check calls what `target.onChange` was given. It answers how to take back everything it subscribed to or armed, and one that throws on install costs only itself.

## The gate

Every signal goes through one gate, made anew for each session, so the rules hold across triggers:

| Situation                                       | What the gate does                                                                                        |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| signals in one moment                           | one read: a check the gate started answers every signal that comes while it is in flight                  |
| a signal within `minInterval` of the last start | waits, and everything that waited becomes one start when the interval ends                                |
| a `reconnect`                                   | checks with `mode: "after-current"`: a read that began before it cannot answer it, so a read begins after |
| a failed check, with a `backoff`                | waits, retries by itself a few times, then waits for the next signal                                      |
| a `reconnect` during that wait                  | checks without waiting for it, but not before `minInterval`                                               |
| a check that succeeded                          | starts the failure count again                                                                            |
| the session ending, or `replaceScope`           | closes the gate; the next session has no failure counted and no start remembered                          |

A check the application starts itself is not the gate's. The gate only knows its own. A clock whose `setTimer` throws is contained as Beacon contains it: the wait the gate would have made is not made, and the error reaches the host outside the call.

### Timing

Every duration is milliseconds on the Beacon's clock, which a test clock replaces, and each one is measured from a different moment:

| Setting                | Measured from                                               | Default                    |
| ---------------------- | ----------------------------------------------------------- | -------------------------- |
| `minInterval`          | the last start of a check                                   | 5,000                      |
| `backoff.first`, `max` | the settling of a failed check                              | no backoff                 |
| `backoff.jitter`       | added to a wait, as a share of it                           | 0.2                        |
| `interval.every`       | the last check the gate started that settled, or the return | required                   |
| `interval.jitter`      | added to `every`, as a share of it                          | 0                          |
| `minAway`              | the report of the departure                                 | 0, so no return is skipped |

The [advanced options](#advanced) have their own defaults: `backoff.attempts` counts consecutive failures and is 3, and `onExpiry` measures from the authority's own `expiresAt` and is off.

### Backoff

```ts
import { checkOn, interval } from "@priemskiyyy/beacon/triggers";

export const stop = checkOn(beacon, {
  triggers: [interval({ every: 30 * 60_000 })],
  backoff: { first: 10_000, max: 15 * 60_000 },
});
```

After a failed check, the gate waits `first` milliseconds, then twice as long for each consecutive failure up to `max`, with up to 20 percent of the wait added at random and never past `max`. When the wait ends, it starts a check by itself, for a few failures. Then it waits for the next signal, which starts a check as soon as its wait is over. Signals that come during a wait become one start at its end, together with the retry. One read that failed is one failure, however many signals it answered. The default is `backoff: false`: nothing is retried by itself and nothing is delayed beyond `minInterval`. A failure of the support policy counts as a failure, and so does any route's.

## Advanced

The defaults are right until a real authority says otherwise. These are the options that most applications never set.

### Retries, jitter and the random source

`backoff: { first, max, jitter, attempts }` also takes `jitter`, the share of a wait added at random (0.2 by default), and `attempts`, the retries the gate starts by itself before it waits for the next signal (3 by default). `random` is the source of every jitter, `Math.random` by default: pass a fixed one in a test.

```ts
import { checkOn, interval } from "@priemskiyyy/beacon/triggers";

export const stop = checkOn(beacon, {
  triggers: [interval({ every: 30 * 60_000 })],
  backoff: { first: 10_000, max: 15 * 60_000, jitter: 0.2, attempts: 3 },
  random: () => 0.5,
});
```

### Freshness

`whileFresh: "skip"` drops a `foreground` or `interval` signal while every route holds evidence that is fresh and can expire: its `expiresAt` is not `null`, and the authority has said the answer still holds. A startup, a reconnect and an invalidation are never skipped, since each says something changed. Neither is a `retry`, which follows a check that failed to renew the answer, nor an `expiry`. Evidence that never expires is never fresh, so a driver route, whose report has no `expiresAt`, always checks.

`onExpiry: true` checks when a route's evidence goes from fresh to expired. It hears the core's own change of the route's state at the authority's `expiresAt`, so it arms no timer of its own. Together, the two check when the authority said to, and on an event that says something changed.

## Stopping

`checkOn` answers its stop. It removes the status listener and every trigger's, cancels every timer the gate armed and ignores what a check that was under way says when it settles. A stopped gate leaves no listener and no timer, and a signal a trigger kept after the stop starts nothing. A session that ends does the same without the stop, and the next session installs the triggers again. A cleanup that throws costs only itself, and its error, like a trigger's on install, is rethrown to the host in a microtask, where Beacon rethrows a listener's.

## What it does not do

- **It makes no runtime run.** A timer of a backgrounded app or tab may be throttled, suspended or never fire: iOS suspends JavaScript soon after the app leaves, Android may keep it a while, and a hidden tab's timers are throttled. Keep `foreground` beside `interval`.
- **The away time is an estimate.** A Pulse's `observedAway` and the time `foreground` measures only throttle a check, and neither is a stopwatch.
- **A reconnect does not prove the authority is reachable.** NetInfo, the browser's `online` and a condition say the device has a connection. A captive portal or a blocked host still fails the check.
- **The gate is per JavaScript runtime.** N tabs are N gates and N reads, and nothing here coordinates them.
- **`Retry-After` is not read.** A `429` fails the read like any failure, and the backoff is yours to configure.
- **`foreground` only checks.** Beacon has no `beacon.reconcile()` yet, so a driver reconciles when a session opens and not on a return.
- **It stores nothing.** A launch has no memory of the last check, so the check at startup runs every time.
- **A check is a read of the authority.** A trigger that fires often asks often: pick `minInterval`, `backoff` and `whileFresh` for the authority you have.

What no device has run, and stays unverified: `AppState` on a device (a system dialog taking iOS to `inactive` and back, every Android pause being `background`), what NetInfo reports on a real change of network and when, and the behavior of timers while the app is in the background. On the web, Chromium has run the `online` event through a real change of the network, and nothing has run `visibilitychange` on a real hidden tab, the `pageshow` of the back-forward cache, Safari or Firefox: the tests drive the browser triggers over a fake page. The tests run the triggers over fakes of each source, the real Pulse over its own mock adapter, and the real Beacon and its test clock. [React Native](react-native.md#what-no-device-has-run) lists the rest.

## Verification

| Claim                                                                                                                                                         | Proven by                                                                                         | State          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------- |
| Nothing is subscribed or armed before `checkOn`, `stop` leaves no listener and no timer, a session's end takes the triggers                                   | scenarios over the real core, the test clock and fakes (`TRIG-01` to `08`)                        | tested         |
| One read per moment, a reconnect reads after the current one, a burst is one start, backoff, jitter, freshness, expiry and a clock that cannot arm a timer    | the same, with the mock source (`TRIG-09` to `19`, `TRIG-30`)                                     | tested         |
| The return rule of `AppState`, `minAway`, NetInfo's first call, a condition, a push                                                                           | the same over fakes of each source (`TRIG-20` to `29`)                                            | tested         |
| A session checks at startup by itself, and `startup: false` leaves the first check to the triggers                                                            | the same, and a real Chromium (`examples/triggers-browser.spec.ts`)                               | tested         |
| The browser triggers: a hidden tab shown again, the back-forward cache, `minAway`, the interval pausing, no window and a window that is React Native's global | scenarios over a fake page (`TRIG-01`, `TRIG-20` to `23`), also under the Hermes-like environment | tested         |
| The `online` event of a real browser is a reconnect, never at startup, and stopping removes the listener                                                      | a real Chromium going offline and back, by `examples/triggers-browser.spec.ts`                    | tested         |
| The real `window` satisfies the structural types of the browser triggers                                                                                      | `packages/core/src/triggers/browser.contracts.ts`, typechecked                                    | tested         |
| A hidden tab and a page restored from the back-forward cache in a real browser, Safari and Firefox                                                            | nothing: a headless page cannot be hidden                                                         | **UNVERIFIED** |
| A Pulse's events and `observedAway` decide the check                                                                                                          | the real Pulse 0.1.0 over its own mock adapter (`TRIG-27`)                                        | tested         |
| The real `AppState` of React Native 0.86.3, NetInfo 12.0.1 and Pulse 0.1.0 satisfy the structural types                                                       | `packages/core/src/triggers/checkOn.contracts.ts`, typechecked                                    | tested         |
| A Reach 0.1.0 condition, React Native 0.87.1 and the strict API of 0.86.3 satisfy them                                                                        | typechecked once in a scratch directory: Reach 0.1.0 is unpublished                               | not in CI      |
| `AppState` on a device: a system dialog taking iOS to `inactive` and back, every Android pause being `background`                                             | nothing                                                                                           | **UNVERIFIED** |
| NetInfo on a device: its first call, its state across a real change of network                                                                                | nothing                                                                                           | **UNVERIFIED** |
| Background timers: iOS suspending JavaScript, Android throttling it, a hidden tab throttling a timer                                                          | nothing                                                                                           | **UNVERIFIED** |
| An `interval` that resumes at the return, and a check that is in flight when the app is suspended                                                             | nothing                                                                                           | **UNVERIFIED** |
| The triggers under Hermes                                                                                                                                     | the same scenarios in the Hermes-like environment, not a device                                   | tested         |

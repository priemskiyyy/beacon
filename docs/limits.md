---
description: "What Beacon does not guarantee: navigation outside it, the local scope of disruption safety, cross-tab coordination, and what a test proves."
---

# Limits

What Beacon does not guarantee, so that no document or type claims more than the code does. Each limit here is checked by `scripts/verify-limits.mjs`, which fails when a statement is removed.

## Navigation and reloads outside Beacon

A framework, a link, the operating system or the user can navigate, reload, update or kill the app without asking Beacon. Beacon guards only the commands it dispatches, so it installs no global navigation guard and claims none. Code that starts a reload or a navigation of its own has to consult its own participants first.

## Disruption safety is local and, unless a participant reserves, advisory

A participant that only answers a question, such as "is there unsaved work?", is advisory: an edit can begin right after it answered. Beacon claims no atomic safety from such a participant. A participant that reserves closes its admission before the command dispatches, and that is the stronger safety the coordinator relies on.

All coordination is local to one Beacon in one JavaScript instance. A lock in one instance is not global exclusivity, and one tab reporting itself ready says nothing about any other tab, worker or runtime.

## Cross-tab coordination

This release coordinates no other tab. There is no simulated global lock: when no lock is available, the scope of every guarantee stays the local instance, and the readiness of one tab never asserts the safety of another.

## Checks on an event or a timer

`@priemskiyyy/beacon-triggers` checks when a source says so and makes no runtime run: a timer of a backgrounded app or tab may be throttled, suspended or never fire, so a check on a timer is only as good as the runtime that runs it, and the return to the foreground has to check as well. The time an app was away, whether a Pulse's `observedAway` or the one the `foreground` trigger measures, is an estimate that only throttles a check. A reconnect says the device is connected and never that the authority is reachable, and the gate that decides a check is per JavaScript runtime, so N tabs make N reads.

## What a test proves

The tests run against fakes, in process. A unit test with a fake bridge proves how Beacon maps a native result, never that a Play update installed, that a service worker activated, that an Expo update launched, that a CodePush package was staged, that a native reader names the build a store shipped or that Firebase Remote Config fetched over a real network. Only a real device with a real distribution proves a provider flow, and the [verification table](verification.md) counts rows with a test, not rows a device passed.

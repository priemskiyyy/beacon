---
description: "The Beacon devtools, for the web: an inspector for the session, the routes, what runs, support, the journal and the diagnostic events, with a React wrapper."
---

# Devtools

`@priemskiyyy/beacon-devtools` is an inspector for one Beacon. It shows where the session stands, what every route observed and on what evidence, what is running, whether it is supported, what the journal knows, and a timeline of the diagnostic events. It is framework independent: it renders inside a shadow root, so your styles never leak in or out, and it bundles its own Solid runtime, so you install nothing else. A React wrapper reads the Beacon from the provider.

::: warning Web only
The inspector renders into a DOM element and keeps its state in `localStorage`, so it runs in a browser and not in React Native, where there is no DOM to mount it into. In a React Native app, log the diagnostic events instead: [Seeing failures in development](react-native.md#seeing-failures-in-development).
:::

```sh
pnpm add -D @priemskiyyy/beacon-devtools
```

## With React

Register your Beacon as [the React binding](react.md) asks, and mount the inspector next to the provider that holds it. The wrapper takes no `beacon` prop: it reads the registered Beacon from the nearest `BeaconProvider`, follows it if the provider's Beacon changes, renders an empty host element on the server and removes the inspector on unmount.

```tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { BeaconDevtools } from "@priemskiyyy/beacon-devtools/react";
import type { PropsWithChildren } from "react";

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}

const Root = ({
  children,
  isDevelopment,
}: PropsWithChildren<{ isDevelopment: boolean }>) => (
  <BeaconProvider beacon={beacon}>
    {children}
    {isDevelopment ? <BeaconDevtools initialIsOpen /> : null}
  </BeaconProvider>
);
```

Render it only in development. The inspector is not part of the release awareness your users rely on, and it costs about 18 KB gzipped, its own copy of Solid included.

## Without a framework

The class at the package root mounts into any element, so it works with Vue, Solid, Svelte or no framework at all:

```ts
import { BeaconDevtools } from "@priemskiyyy/beacon-devtools";

const devtools = new BeaconDevtools({ beacon });

devtools.mount(document.body.appendChild(document.createElement("div")));
```

| Option          | Default | Meaning                                                                       |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| `beacon`        |         | The Beacon to inspect. The React wrapper takes it from the provider.          |
| `initialIsOpen` | `false` | Opens the panel on the first visit. Later visits restore the last open state. |
| `maxEvents`     | `200`   | Events kept in memory, clamped to 1 to 1000.                                  |

The class has `mount(element)`, `unmount()`, `setBeacon(beacon)` for an application that replaces its Beacon, and `setMaxEvents(count)`. Mounting twice throws a `BeaconError`, unmounting twice does nothing, and the recorded events survive an unmount and appear again on the next mount.

## What it shows

- **The header.** The session (idle, running with its number, stopped or disposed), the diagnostic counters of what Beacon dropped or contained, and a Check now button.
- **The routes.** One row per name in `beacon.routeNames`: the observation, the last check with its error code, the operation and what is prepared. Selecting one shows its observation with its evidence (source, origin, freshness, when it was received and when it expires, issuer and revision), its offer, its prepared target, its last check, its operation and what each of its commands declares.
- **The overview.** What runs per subject (not configured, pending, known with its identity and label, or failed), the support state with its reasons, remediation and evaluation evidence, and the journal with the latest intent, what the running facts say about it, its attempts and this boot's readiness checkpoints.
- **The timeline.** The local time, the type, the session, the route, the command, the attempt, the operation and the reason of each event. A chip filters one type at a time, a search box filters the rest, and Pause and Clear affect only the inspector. A row expands into the whole record, with a copy button. Selecting a route narrows the timeline to that route and to the events that belong to no route.

The launcher turns red when a failure event arrives while the panel is closed: `route-failed`, `policy-failed`, `journal-failed`, `running-failed`, `read-failed`, `listener-error`, `cleanup-error` and `late-callback`. The panel docks to the bottom or the right edge and resizes by dragging its edge or with the arrow keys along it. Opening it moves focus into it, and Escape closes it and moves focus back to the launcher; a panel restored from the last visit never takes focus. The open state, the dock position and the size persist in `localStorage` under `@priemskiyyy/beacon-devtools`, and a value that is missing, corrupt or out of range (a size under 240 pixels) is ignored.

## What it never does

- It never starts a session, never reads what the application has not reached, and never calls a command. Its only action is `beacon.check({ reason: "manual" })`, and only while a session runs. The Beacon it takes is typed down to the snapshots, the diagnostics and `check`, so it has no `start`, `stop`, `dispose`, `replaceScope` or route command to call.
- Mounting it changes nothing about how the Beacon behaves. Subscribing to `beacon.diagnostics.events` builds events only while someone listens, which is by design, and pausing releases that subscription.
- It shows no raw value by default. What a platform reported for what is running (`RunningRelease.raw`) and a provider's `native` handle stay hidden until Show raw values is ticked. The handle is not even read until then, and the choice is never stored.
- Whatever is shown, a property whose name contains `token`, `authorization`, `password`, `passwd`, `pwd`, `secret`, `cookie`, `credential`, `api key` (`apiKey`, `api_key` or `api-key`), `private key`, `bearer` or `jwt`, in any case, is replaced at any depth. Values are copied into plain, bounded data by reading property descriptors, so no getter, `toJSON` or `get` trap of yours runs, and a proxy is read through its key and descriptor traps only. An object that is not plain, such as a `window` or a provider client, is named by its class and not walked. Events are copied field by field, their text cut to a limit, and keep nothing but their own fields.
- The inspector cannot know that a text you wrote yourself, such as a release label, holds a secret. Keep those out of labels.

## Limits

What it copies is bounded. A text on one line of the panel, such as an event field or a release identity, is cut at 200 characters. A raw value or a provider handle is cut at 6 levels deep, 200 values in all, 50 entries of one object or list and 2,000 characters of one text, and a copied or expanded record at 12,000 characters. A cut says `[Truncated]`.

Only Chromium has run it, and only through a scratch page: pointer dragging is tested with a stubbed pointer capture in jsdom, and no device has run it. A failure that arrives while recording is paused does not turn the launcher red.

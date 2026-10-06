# @priemskiyyy/beacon-devtools

An inspector for [Beacon](../core): where the session stands, what every route has observed and on what evidence, what is running, whether it is supported, what the journal knows, and a timeline of the diagnostic events. It is framework independent and renders inside a shadow root, so host styles never leak in or out, and it bundles its own Solid runtime, so a host needs no Solid install. The React wrapper reads the Beacon from its provider.

## Installation

```sh
pnpm add -D @priemskiyyy/beacon-devtools
```

## Use

With React, next to the provider that holds the Beacon:

```tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { BeaconDevtools } from "@priemskiyyy/beacon-devtools/react";

<BeaconProvider beacon={beacon} start>
  <Application />
  {import.meta.env.DEV ? <BeaconDevtools initialIsOpen /> : null}
</BeaconProvider>;
```

The wrapper takes no `beacon` prop. It reads the Beacon you registered with `Register`, renders an empty host element on the server, follows the provider's Beacon after mount, and removes the inspector when it unmounts.

Without a framework, construct the class from the package root and mount it into any element:

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

The class has `mount(element)`, `unmount()`, `setBeacon(beacon)` for an application that replaces its Beacon, and `setMaxEvents(count)`. Mounting twice throws a `BeaconError`, unmounting twice does nothing, and the recorded events survive an unmount.

## What it shows

- The header: the session (idle, running with its number, stopped, disposed), the diagnostic counters of what Beacon dropped or contained, and Check now.
- The routes, one row per name in `beacon.routeNames`: the observation, the last check with its error code, the operation and what is prepared. Selecting one shows its observation with evidence (source, origin, freshness, when it was received and when it expires, issuer, revision), its offer, its prepared target, its last check, its operation and what each of its commands declares.
- The overview: what runs per subject (pending, known with its identity and label, unreadable), the support state with its reasons, remediation and evaluation evidence, and the journal with the latest intent, what the running facts say about it, its attempts and this boot's readiness checkpoints.
- The timeline: the local time, the type, the session, the route, the command, the attempt, the operation and the reason of each event, a chip for each type recorded, a search, pause, clear, and rows that expand into the whole record with a copy button. Selecting a route narrows it to that route and to the events of no route. The launcher turns red when a failure event arrives while the panel is closed: `route-failed`, `policy-failed`, `journal-failed`, `running-failed`, `read-failed`, `listener-error`, `cleanup-error` and `late-callback`.

The panel docks to the bottom or the right edge and resizes by dragging its edge or with the arrow keys. The open state, the dock position and the size persist in `localStorage`, and a value that is missing, corrupt or out of range is ignored.

## What it never does

- It never starts a session, never reads what the application has not reached, and never calls a command. Its only action is `beacon.check({ reason: "manual" })`, and only while a session runs. The Beacon it takes is typed down to the snapshots, the diagnostics and `check`.
- Mounting it changes nothing about how the Beacon behaves. Subscribing to `beacon.diagnostics.events` builds events only while someone listens, which is by design, and pausing releases that subscription.
- It shows no raw value by default. What a platform reported for what is running (`RunningRelease.raw`) and a provider's `native` handle stay hidden until Show raw values is ticked, the handle is not even read until then, and the choice is never stored.
- Whatever is shown, a property named like `token`, `authorization`, `password`, `secret`, `cookie`, `credential` or `api key` is replaced at any depth. Values are copied into plain, bounded data by reading property descriptors, so no getter, `toJSON` or proxy trap of yours runs, and an object that is not plain, such as a `window` or a provider client, is named by its class and not walked. Events are copied the same way, cut to a limit, and keep nothing but their own fields.

The inspector cannot know that a text you wrote yourself, such as a release label, holds a secret. Keep those out of labels.

## License

[MIT](LICENSE)

# @priemskiyyy/beacon-devtools

An inspector for [Beacon](../core), for the web: where the session stands, what every route has observed and on what evidence, what is running, whether it is supported, what the journal knows, and a timeline of the diagnostic events. It is framework independent and renders inside a shadow root, so host styles never leak in or out, and it bundles its own Solid runtime, so a host needs no Solid install.

It is web only. The inspector renders into a DOM element and keeps its state in `localStorage`, so it does not run in React Native, where there is no DOM to mount it into. There, log `beacon.diagnostics.events` instead, as the [React Native guide](../../docs/react-native.md#seeing-failures-in-development) shows.

## Installation

```sh
pnpm add -D @priemskiyyy/beacon-devtools
```

## Example

With React, register your Beacon as the React binding asks, and mount the inspector next to the provider that holds it, in development only:

```tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { BeaconDevtools } from "@priemskiyyy/beacon-devtools/react";

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}

const Root = ({ isDevelopment }: { isDevelopment: boolean }) => (
  <BeaconProvider beacon={beacon}>
    <UpdateBanner />
    {isDevelopment ? <BeaconDevtools initialIsOpen /> : null}
  </BeaconProvider>
);
```

The wrapper takes no `beacon` prop: it reads the Beacon you registered, renders an empty host element on the server and removes the inspector when it unmounts. Without a framework, construct the class from the package root and mount it into any element:

```ts
import { BeaconDevtools } from "@priemskiyyy/beacon-devtools";

const devtools = new BeaconDevtools({ beacon });

devtools.mount(document.body.appendChild(document.createElement("div")));
```

## Options

| Option          | Default | Meaning                                                                       |
| --------------- | ------- | ----------------------------------------------------------------------------- |
| `beacon`        |         | The Beacon to inspect. The React wrapper takes it from the provider.          |
| `initialIsOpen` | `false` | Opens the panel on the first visit. Later visits restore the last open state. |
| `maxEvents`     | `200`   | Events kept in memory, clamped to 1 to 1000.                                  |

It never starts a session and never calls a command: its only action is `beacon.check({ reason: "manual" })` while a session runs. It shows no raw value by default, and replaces a property named like a secret at any depth.

## Learn more

[The devtools guide](../../docs/devtools.md) has what each part shows, what it never does and its limits: it costs about 18 KB gzipped, so render it in development only.

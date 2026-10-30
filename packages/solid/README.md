# @priemskiyyy/beacon-solid

Solid bindings for [Beacon](../core): primitives that read route state and what is running as accessors, and a provider that holds the observation session while it is mounted. Reading never starts a session, checks a route or requests a command.

Version 0.1.0 is an initial preview. APIs may change before 1.0. See the [verification limits](https://github.com/priemskiyyy/beacon/blob/main/docs/verification.md) before adopting an adapter.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-solid
```

Requires `solid-js` 1.9 or later.

## Set up

Register your Beacon once, next to where you create it, so every primitive knows its route names and their types:

```ts
// beacon.ts
export const beacon = new Beacon({ scope, running, routes: { web } });

declare module "@priemskiyyy/beacon-solid" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

Publish it once, near the root. The provider holds the observation session while mounted, follows a new `beacon` or `start`, and `start={false}` leaves the session to you:

```tsx
import { BeaconProvider } from "@priemskiyyy/beacon-solid";
import { render } from "solid-js/web";

render(
  () => (
    <BeaconProvider beacon={beacon}>
      <UpdateBanner />
    </BeaconProvider>
  ),
  document.body,
);
```

## Use

Every primitive returns an accessor, so read it by calling it, and Solid tracks it:

```tsx
import { Show } from "solid-js";
import { useBeacon, useDisruption, useRoute } from "@priemskiyyy/beacon-solid";

const UpdateBanner = () => {
  const beacon = useBeacon();

  const offer = useRoute("web", ({ observation }) => {
    if (observation.status !== "available") {
      return undefined;
    }

    return observation.offer;
  });

  useDisruption({
    name: "draft-editor",
    reserve: () => {
      if (isDirty()) {
        return { status: "blocked", code: "unsaved-draft" };
      }

      return { status: "reserved" };
    },
  });

  return (
    <Show when={offer()}>
      {(current) => (
        <button
          onClick={() => beacon().route("web").reload({ offer: current() })}
        >
          Update
        </button>
      )}
    </Show>
  );
};
```

`useRoute("elsewhere")` fails to compile, and the state it returns has the offer and prepared target types of that route.

| Export            | Does                                                                                                       |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `BeaconProvider`  | publishes a Beacon and holds the session while mounted; `start={false}` opts out                           |
| `useRoute`        | a route's state by its name, optionally selected, with the types of its own offer and prepared target      |
| `useRunning`      | what is running per subject; a subject that is not read yet is pending, never an old version               |
| `useSupport`      | what the support policy says about what runs                                                               |
| `useTransitions`  | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints |
| `useBeaconStatus` | where the session stands: idle, running, stopped or disposed                                               |
| `useDisruption`   | registers a participant on the provider's Beacon while mounted, once                                       |
| `useObservable`   | any other observable of Beacon, such as `beacon.route("web").native`                                       |
| `useBeacon`       | an accessor of the provider's Beacon, for commands (`reload`, `activate`, `download`, ...) and for `check` |

Every selector primitive takes `(selector, { isEqual })`: what depends on it runs again only when the selection changes by `isEqual` (`Object.is` by default), and the selector runs untracked. The route name and the observable are fixed when the primitive is called, and the Beacon they read is the provider's, so they follow a provider whose `beacon` changes. The participant of `useDisruption` is registered once: its closures read your signals at the moment Beacon asks, so there is nothing to keep fresh.

Without a provider, `useBeacon()` and every primitive that reads the provider's Beacon throw `BeaconError` with `INVALID_CONFIGURATION`.

## Learn more

[The Solid guide](../../docs/solid.md) has every primitive, server rendering and hydration, and testing. [Getting started](../../docs/getting-started.md) takes a web app from a manifest to a guarded update banner, and [the mental model](../../docs/mental-model.md) names the vocabulary.

# @priemskiyyy/beacon-svelte

Svelte 5 bindings for [Beacon](../core): utilities that read route state and what is running through `current`, and a provider that holds the observation session while it is mounted. Reading never starts a session, checks a route or requests a command.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-svelte
```

Requires Svelte 5.7 or later. The package ships its sources for your Svelte compiler.

## Set up

Register your Beacon once, next to where you create it, so every utility knows its route names and their types:

```ts
// beacon.ts
export const beacon = new Beacon({ scope, running, routes: { web } });

declare module "@priemskiyyy/beacon-svelte" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

Publish it once, near the root. The provider holds the observation session while mounted, and `start={false}` leaves the session to you:

```svelte
<!-- App.svelte -->
<script lang="ts">
  import { BeaconProvider } from "@priemskiyyy/beacon-svelte";
  import { beacon } from "./beacon";
  import UpdateBanner from "./UpdateBanner.svelte";
</script>

<BeaconProvider {beacon}>
  <UpdateBanner />
</BeaconProvider>
```

## Use

Call the utilities while a component initializes, as you would `getContext`, and read what they return through `current`:

```svelte
<!-- UpdateBanner.svelte -->
<script lang="ts">
  import {
    useBeacon,
    useDisruption,
    useRoute,
    useRunning,
  } from "@priemskiyyy/beacon-svelte";

  const observation = useRoute("web", ({ observation }) => observation);
  const running = useRunning(({ web }) => web);
  const beacon = useBeacon();

  let dirty = $state(false);

  useDisruption({
    name: "draft-editor",
    reserve: () => {
      if (dirty) {
        return { status: "blocked", code: "unsaved-draft" };
      }

      return { status: "reserved" };
    },
  });
</script>

{#if running.current.state === "known"}
  <p>Running {running.current.release.label}</p>
{/if}

{#if observation.current.status === "available"}
  {@const offer = observation.current.offer}
  <button onclick={() => beacon.current.route("web").reload({ offer })}>
    Update to {offer.release.label}
  </button>
{/if}
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
| `useDisruption`   | registers a participant while mounted; Beacon asks it as it is, so its closures read the current state     |
| `useObservable`   | any other observable of Beacon, such as `beacon.current.route("web").native`                               |
| `useBeacon`       | the provider's Beacon through `current`, for commands (`reload`, `activate`, `download`, ...) and `check`  |

Every selector utility takes `(selector, { isEqual })`: what depends on it runs again only when the selection changes by `isEqual` (`Object.is` by default). The route name, the observable and the selector are read once, when the component initializes; a provider that publishes another Beacon is followed.

## Learn more

[The Svelte guide](../../docs/svelte.md) has every utility, server rendering and hydration, and testing. [Getting started](../../docs/getting-started.md) takes a web app from a manifest to a guarded update banner, and [the mental model](../../docs/mental-model.md) names the vocabulary.

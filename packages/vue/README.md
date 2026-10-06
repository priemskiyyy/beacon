# @priemskiyyy/beacon-vue

Vue bindings for [Beacon](../core): composables that read route state and what is running, and a provider that can hold the observation session. Reading never starts a session, checks a route or requests a command.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-vue
```

Requires Vue 3.5 or later.

## Set up

Register your Beacon once, next to where you create it, so every composable knows its route names and their types:

```ts
// beacon.ts
export const beacon = new Beacon({ scope, running, routes: { web } });

declare module "@priemskiyyy/beacon-vue" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

Publish it once, near the root. With `start` the provider holds the observation session while mounted:

```vue
<!-- App.vue -->
<script setup lang="ts">
import { BeaconProvider } from "@priemskiyyy/beacon-vue";

import { beacon } from "./beacon";
import UpdateBanner from "./UpdateBanner.vue";
</script>

<template>
  <BeaconProvider :beacon="beacon" start>
    <UpdateBanner />
  </BeaconProvider>
</template>
```

The provider follows a new `beacon` or `start` prop: it ends the old session and starts the new one. Keep a Beacon you swap in a `shallowRef`, since a deep `ref` would proxy it.

## Use

```vue
<!-- UpdateBanner.vue -->
<script setup lang="ts">
import {
  useBeacon,
  useDisruption,
  useRoute,
  useRunning,
} from "@priemskiyyy/beacon-vue";
import { ref } from "vue";

const observation = useRoute("web", ({ observation }) => observation);
const running = useRunning(({ web }) => web);
const beacon = useBeacon();
const dirty = ref(false);

useDisruption({
  name: "draft-editor",
  impacts: ["document-replacement"],
  reserve: () => {
    if (dirty.value) {
      return { status: "blocked", code: "unsaved-draft" };
    }

    return { status: "reserved", release: resume };
  },
});
</script>

<template>
  <button
    v-if="observation.status === 'available'"
    @click="beacon.route('web').reload({ offer: observation.offer.ref })"
  >
    Update
  </button>
</template>
```

Every composable returns a read-only `ComputedRef`, so `observation` is unwrapped in the template and `.value` in a script. `useRoute("elsewhere")` fails to compile, and the state it returns has the offer and prepared target types of that route.

| Export           | Does                                                                                                                                     |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `BeaconProvider` | publishes a Beacon; with `start` it holds the session while mounted and ends only that session on unmount                                |
| `useRoute`       | a route's state by its name, optionally selected, with the types of its own offer and prepared target                                    |
| `useRunning`     | what is running per subject; a subject that is not read yet is pending, never an old version                                             |
| `useSupport`     | what the support policy says about what runs                                                                                             |
| `useTransitions` | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints                               |
| `useStatus`      | where the session stands: idle, running, stopped or disposed                                                                             |
| `useDisruption`  | registers a participant while mounted; it registers once, so its closures read reactive state when Beacon asks                           |
| `useObservable`  | any other observable of Beacon, such as `beacon.route("web").native`                                                                     |
| `useBeacon`      | a `ComputedRef` of the provider's Beacon, for commands (`reload`, `activate`, `download`, ...) and for `check`, and it follows a new one |

Every selector composable takes `(selector, { isEqual })`: its ref changes only when the selection changes by `isEqual` (`Object.is` by default), so nothing that reads it runs again for an equal selection. The `name` and the observable you pass are read once; the provider's Beacon is followed.

A component that unmounts lets go of everything it subscribed to. Call the composables in `setup`, where Vue can tie them to the component.

## Server rendering

The server and the hydrating render read every observable as it stood before any session (`getInitial`), so the markup matches whatever the client has learned by then, and a boundary that hydrates late still matches. Once the component is mounted, its refs switch to the live value and follow it. Start the Beacon through the provider and not before the hydrating render. The provider starts it before its children mount, so a check in a component's `onMounted` finds the session running. A server render starts nothing and reads nothing, and two requests never share a session.

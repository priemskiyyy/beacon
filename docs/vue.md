---
description: "Use Beacon from Vue: register your Beacon, publish it with BeaconProvider, read routes and running facts with typed composables, guard unsaved work, and render on the server."
---

# Vue

`@priemskiyyy/beacon-vue` is a provider and a set of composables. The provider holds the observation session while it is mounted, and reading never starts one, checks a route or requests a command. Checks and commands stay explicit, so a component that reads a route can be rendered anywhere without a side effect.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-vue
```

It needs Vue 3.5 or later. The examples use `<script setup lang="ts">`.

## Register your Beacon

Register it once, next to where you create it. Every composable then knows the names of your routes and the types of their offers.

```ts
// src/beacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseSource,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { browserReload, webBuild } from "@priemskiyyy/beacon-browser";

// Your source of the deployment decision; see the HTTP page.
declare const manifest: ReleaseSource<{ web: TargetDecision | NoneDecision }>;

export const createBeacon = () =>
  new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "web",
      distribution: "public-web",
    },
    running: {
      web: webBuild({ id: import.meta.env.VITE_BUILD_ID }),
    },
    routes: {
      web: targetRoute({
        source: manifest.select((document) => document.web),
        mechanism: browserReload(),
      }),
    },
  });

export const beacon = createBeacon();

declare module "@priemskiyyy/beacon-vue" {
  interface Register {
    beacon: ReturnType<typeof createBeacon>;
  }
}
```

Without it, the provider still takes your Beacon and the composables that name no route (`useBeaconStatus`, `useRunning`, `useSupport`, `useTransitions`, `useDisruption`) work, but a composable that takes a route name fails to compile with the fix as the type it expected: `Register your Beacon: declare module "@priemskiyyy/beacon-vue" { interface Register { beacon: typeof beacon } }`. `Register` is an interface so that you can merge into it.

## BeaconProvider

Publish the Beacon once, near the root. The provider is a component. It takes the Beacon and `start` as props, starts the session, and renders its default slot.

```vue
<!-- src/Root.vue -->
<script setup lang="ts">
import { BeaconProvider } from "@priemskiyyy/beacon-vue";
import type { RegisteredBeacon } from "@priemskiyyy/beacon-vue";

import App from "src/App.vue";

defineProps<{ beacon: RegisteredBeacon }>();
</script>

<template>
  <BeaconProvider :beacon="beacon">
    <App />
  </BeaconProvider>
</template>
```

The root takes the Beacon as a prop, so the server and the browser share one root and differ only in the Beacon they pass.

```ts
// src/main.ts
import { createApp } from "vue";

import Root from "src/Root.vue";
import { beacon } from "src/beacon";

createApp(Root, { beacon }).mount("#app");
```

| Prop     | Meaning                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| `beacon` | the registered Beacon to publish to the components below                                                             |
| `start`  | `true` by default: the provider holds the observation session while it is mounted. `false` leaves the session to you |

The provider owns the session. It calls `beacon.start()` just before it mounts and ends that session when it unmounts. It never disposes the Beacon, and it checks nothing. A new `beacon` or `start` prop ends the old session, and starts a new one unless `start` is `false`. Keep a Beacon that you swap in a `shallowRef`, since a deep `ref` would wrap it in a proxy.

Pass `:start="false"` when something else owns the session, such as a service of yours that calls `beacon.start()` itself: the provider then publishes the Beacon and starts and stops nothing. A component of yours that forwards `start` to the provider must give it the default `true` (`withDefaults(defineProps<{ start?: boolean }>(), { start: true })`), since Vue reads an absent boolean prop as `false`. Mount one provider per Beacon. `start()` while a session is open answers the same stop, so a second provider on the same Beacon shares that session, and the first of them to unmount ends it for both.

The session starts before any child of the provider is created. A check in a child's `onMounted` therefore finds the session running and does not fail with `NOT_STARTED`. Checks are yours, and [`checkOn`](triggers.md) makes the ones an application usually wants, on a return, a reconnect or a timer, over any binding. A check of your own:

```ts
// src/useStartupCheck.ts
import { useBeacon } from "@priemskiyyy/beacon-vue";
import { onMounted } from "vue";

export const useStartupCheck = () => {
  const beacon = useBeacon();

  onMounted(() => {
    beacon.value.check({ reason: "startup" });
  });
};
```

```vue
<!-- src/App.vue -->
<script setup lang="ts">
import UpdateBanner from "src/UpdateBanner.vue";
import { useStartupCheck } from "src/useStartupCheck";

useStartupCheck();
</script>

<template>
  <main>
    <UpdateBanner />
  </main>
</template>
```

## The composables

Every composable returns a read-only `ComputedRef`. Read `.value` in a script. A template unwraps the ref.

| Composable        | Reads                                                                                                                  |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `useRoute`        | a route's state by its name, optionally selected, with the types of its own offer and prepared target                  |
| `useRunning`      | what is running per subject. A subject that is not read yet is pending, never an old version                           |
| `useSupport`      | what the support policy says about what runs                                                                           |
| `useTransitions`  | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints             |
| `useBeaconStatus` | where the session stands: idle, running, stopped or disposed                                                           |
| `useObservable`   | any other observable of Beacon, such as `beacon.value.route("web").native`                                             |
| `useDisruption`   | registers a participant while mounted; it registers once, so its closures read your state when asked                   |
| `useBeacon`       | a `ComputedRef` of the provider's Beacon, for commands (`reload`, `activate`, `download` and the rest) and for `check` |

Call them in `setup`, where Vue can tie them to the component. A component that unmounts lets go of everything it subscribed to.

### Selectors

Every reading composable takes a selector and an options object: `useRoute(name, selector, { isEqual })`. Without a selector you get the whole snapshot. With one, the ref changes only when the selection changes by `isEqual`, which is `Object.is` by default. A `watch`, a `computed` or a template that reads it runs again only then.

```vue
<!-- src/RouteComposables.vue -->
<script setup lang="ts">
import {
  useRoute,
  useRunning,
  useBeaconStatus,
  useSupport,
  useTransitions,
} from "@priemskiyyy/beacon-vue";

const checking = useRoute("web", ({ check }) => check.state === "checking");
const web = useRunning(({ web }) => web);
const active = useBeaconStatus(({ state }) => state === "running");
const unsupported = useSupport(({ status }) => status === "unsupported");
const exhausted = useTransitions(({ latest }) => latest?.exhausted === true);

const summary = useRoute(
  "web",
  ({ observation }) => ({ status: observation.status }),
  { isEqual: (previous, next) => previous.status === next.status },
);
</script>

<template>
  <dl>
    <dt>Checking</dt>
    <dd>{{ checking }}</dd>
    <dt>Running</dt>
    <dd>{{ web.state }}</dd>
    <dt>Session</dt>
    <dd>{{ active }}</dd>
    <dt>Unsupported</dt>
    <dd>{{ unsupported }}</dd>
    <dt>Reload keeps failing</dt>
    <dd>{{ exhausted }}</dd>
    <dt>Observation</dt>
    <dd>{{ summary.status }}</dd>
  </dl>
</template>
```

A selection that builds a new object every time, like `summary` above, needs an `isEqual`, or its ref changes on every change of the snapshot. A selection that `isEqual` calls the same keeps the ref's last value. The function takes two values of the selected type, and one typed for another type does not compile.

`useRoute("elsewhere")` fails to compile, and the state it returns has the offer and prepared target types of that route.

```ts
// src/typos.ts
import { useRoute } from "@priemskiyyy/beacon-vue";

export const useTypo = () =>
  // @ts-expect-error There is no route named "elsewhere".
  useRoute("elsewhere");
```

### What is read once

The route name, the observable, the selector and the options are read once, when the composable is called. Pass a plain name, and not a ref. The provider's Beacon is the one thing that is followed: a provider whose `beacon` prop changes moves every composable below it to the new Beacon.

The selector runs when Beacon reports a change. It is not tracked, so a ref that it reads does not run it again. Select from Beacon's value only, and combine your own state in a `computed`.

```ts
// src/useLabel.ts
import { useRoute } from "@priemskiyyy/beacon-vue";
import { computed } from "vue";
import type { Ref } from "vue";

export const useLabel = (prefix: Ref<string>) => {
  const status = useRoute("web", ({ observation }) => observation.status);

  return computed(() => `${prefix.value}: ${status.value}`);
};
```

In `setup`, a ref holds the value from before any session. It switches to the live value when the component mounts. Decide in a `watch`, a `computed` or the template, which run again, and not from a value you read once in `setup`.

The refs are read-only. Writing `.value` warns and changes nothing.

### Commands and checks

A command is an action, so it belongs in an event handler. Take the Beacon with `useBeacon`.

```vue
<!-- src/UpdateBanner.vue -->
<script setup lang="ts">
import { useBeacon, useRoute } from "@priemskiyyy/beacon-vue";

const beacon = useBeacon();
const observation = useRoute("web", (snapshot) => snapshot.observation);

const update = async () => {
  if (observation.value.status !== "available") {
    return;
  }

  const outcome = await beacon.value
    .route("web")
    .reload({ offer: observation.value.offer });

  if (outcome.status === "blocked") {
    console.info(outcome.reasons.map((reason) => reason.code));
  }
};
</script>

<template>
  <button v-if="observation.status === 'available'" @click="update">
    Update
  </button>
</template>
```

`useBeacon` returns a `ComputedRef` of the provider's Beacon, typed by the one you registered, and it follows a new one. It throws a `BeaconError` with `INVALID_CONFIGURATION` when no provider is above it, and so does every composable that reads the provider's Beacon: the message names the composable you called and the package that has the provider, such as `useRoute needs a BeaconProvider (from @priemskiyyy/beacon-vue) above it.` Called where Vue has no component, such as in an event handler or a timer, it finds no provider and throws the same error, so take the Beacon in `setup`.

### Other observables

`useObservable` is what the other composables are made of. Use it for an observable they do not name, such as a route's native handle. `useObservable(observable, selector, options)` takes the same selector and options.

```vue
<!-- src/NativeHandle.vue -->
<script setup lang="ts">
import { useBeacon, useObservable } from "@priemskiyyy/beacon-vue";

const beacon = useBeacon();
const native = useObservable(beacon.value.route("web").native);
</script>

<template>
  <span>{{ native === null ? "closed" : "open" }}</span>
</template>
```

The observable is read once, so it does not follow a provider that publishes another Beacon. For a route handle you hold, read `handle.state` with `useObservable`. It needs no provider.

## Guarding unsaved work

`useDisruption` registers a participant when the component mounts and unregisters it when the component unmounts. It registers once, and Beacon asks the participant's closures, so a closure over a ref reads its value at that moment and never goes stale. When the provider publishes another Beacon, the registration leaves the old one and joins the new one.

```vue
<!-- src/DraftEditor.vue -->
<script setup lang="ts">
import { useDisruption } from "@priemskiyyy/beacon-vue";
import { ref } from "vue";

const props = defineProps<{ save: (text: string) => Promise<boolean> }>();

const text = ref("");
const saved = ref("");
const locked = ref(false);

const edit = (event: Event) => {
  if (locked.value || !(event.target instanceof HTMLTextAreaElement)) {
    return;
  }

  text.value = event.target.value;
};

useDisruption({
  name: "draft-editor",
  reserve: () => {
    // A ref changes at once, so edit refuses from now on, before Vue renders again.
    locked.value = true;

    return {
      status: "reserved",
      settle: async () => {
        if (text.value === saved.value) {
          return { status: "ready" };
        }

        if (await props.save(text.value)) {
          saved.value = text.value;

          return { status: "ready" };
        }

        return { status: "blocked", code: "draft-not-saved" };
      },
      resume: () => {
        locked.value = false;
      },
    };
  },
});
</script>

<template>
  <textarea :value="text" :readonly="locked" @input="edit" />
</template>
```

A reservation a component holds stays valid after the component unmounts, as long as the service behind it lives. It is released when the command ends, not when the view goes. So a participant that guards real work should be owned by a service, and the composable is a convenient way to register it while a view exists. [Disruptions](disruptions.md) has the whole order of steps.

## Testing

Mount the component under `BeaconProvider` with a real Beacon over the mock source and the test clock, and drive it the way [the testing guide](testing.md) does: answer, check, advance. Reading in a composable never starts a session, but the provider does, so a Beacon mounted under it is running. Pass `:start="false"` to the provider when a test opens the session itself.

- Run the tests in a DOM environment such as jsdom, and test a server render in a Node environment. Keep one copy of `vue` in the test build (`resolve.dedupe`), so that the binding and your components share one reactivity system.
- Await `nextTick()` after a change, since Vue updates the DOM on the next tick. A ref changes at once, and the DOM follows.
- Mount with `createApp`, and unmount the app at the end so the provider ends its session.

```ts
// src/testBeacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseIdentity,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
import { browserReload } from "@priemskiyyy/beacon-browser";

type Deployment = { web: TargetDecision | NoneDecision };

const identity = (value: string): ReleaseIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value,
});

export const deploy = (value: string): Deployment => ({
  web: {
    kind: "target",
    release: { identity: identity(value), label: `Build ${value}` },
  },
});

export const createTestBeacon = () => {
  const mock = createMockSource<Deployment>({ name: "manifest" });

  const beacon = new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "web",
      distribution: "public-web",
    },
    running: {
      boot: { id: "boot-1" },
      web: () => ({ identity: identity("web-build-a"), label: null, raw: {} }),
    },
    routes: {
      web: targetRoute({
        source: mock.source.select((document) => document.web),
        mechanism: browserReload({
          target: { location: { reload: () => {} } },
        }),
      }),
    },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, mock };
};
```

```ts
// src/UpdateBanner.test.ts
import { BeaconProvider } from "@priemskiyyy/beacon-vue";
import { expect, test } from "vitest";
import { createApp, h, nextTick } from "vue";

import UpdateBanner from "src/UpdateBanner.vue";
import { createTestBeacon, deploy } from "src/testBeacon";

test("the banner offers the update once a check finds one", async () => {
  const { beacon, mock } = createTestBeacon();
  const container = document.createElement("div");

  const app = createApp({
    render: () => h(BeaconProvider, { beacon }, () => h(UpdateBanner)),
  });

  app.mount(container);

  expect(container.querySelector("button")).toBeNull();

  mock.answer({ document: deploy("web-build-b") });
  await beacon.check();
  await nextTick();

  expect(container.querySelector("button")?.textContent?.trim()).toBe("Update");

  app.unmount();
});
```

## Server rendering and hydration

The server and the hydrating render read every observable as it stood before any session, through `getInitial`. On the server that is what `renderToString` prints: the route is `unknown` with `not-checked`, and what runs is `pending`. The markup therefore matches whatever the client has learned by the time it hydrates, even when a boundary hydrates late and the live state has moved on. Once a component is mounted, its refs switch to the live value and follow it.

- Design the first render for `unknown` and `pending`: show nothing until the observation is `available`.
- Let the provider start the Beacon, and not before the hydrating render. It starts it before any child mounts, so a check in a component's `onMounted` does not fail with `NOT_STARTED`.
- A server render starts nothing and reads nothing, since mount hooks never run on the server. The provider starts no session on the server. Create the Beacon for each request, and never start it yourself on the server, so that two requests never share a session or a state.

```ts
// src/render.ts
import { createSSRApp } from "vue";
import { renderToString } from "vue/server-renderer";

import Root from "src/Root.vue";
import { beacon, createBeacon } from "src/beacon";

export const renderOnTheServer = () =>
  renderToString(createSSRApp(Root, { beacon: createBeacon() }));

export const hydrateOnTheClient = (container: HTMLElement) =>
  createSSRApp(Root, { beacon }).mount(container);
```

## Types

The registration exposes the types of your Beacon, for props and helpers.

| Type                          | Is                                      |
| ----------------------------- | --------------------------------------- |
| `Register`                    | the interface you merge `beacon` into   |
| `RegisteredBeacon`            | the Beacon you registered               |
| `RegisteredRoutes`            | its routes                              |
| `RegisteredRouteName`         | the union of its route names            |
| `RegisteredRoute<TName>`      | the handle of one route                 |
| `RegisteredRouteState<TName>` | the snapshot of one route               |
| `BeaconProviderProps`         | the props of the provider               |
| `SelectorOptions<TSelected>`  | the `{ isEqual }` options of a selector |

```ts
import type { RegisteredRouteState } from "@priemskiyyy/beacon-vue";

export const describeWeb = ({ observation }: RegisteredRouteState<"web">) =>
  observation.status;
```

The same bindings exist for [React](react.md), [Solid](solid.md) and [Svelte](svelte.md).

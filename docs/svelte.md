---
description: "Use Beacon from Svelte 5: register your Beacon, publish it with BeaconProvider, read routes and running facts with typed utilities, guard unsaved work, and render on the server."
---

# Svelte

`@priemskiyyy/beacon-svelte` is a provider and a set of utilities for Svelte 5. Each utility returns an object whose `current` property holds the value. Reading never starts a session, checks a route or requests a command. Those stay explicit, so a component that reads a route can be rendered anywhere without a side effect.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-svelte
```

It needs Svelte 5.7 or later. The package ships its sources, so the Svelte plugin of your bundler compiles it with your own components.

## Register your Beacon

Register it once, next to where you create it. Every utility then knows the names of your routes and the types of their offers.

```ts
// src/beacon.ts
import { Beacon, targetRoute } from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ReleaseSource,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { browserReload } from "@priemskiyyy/beacon-browser";

// Your source of the deployment decision; see the HTTP page.
declare const manifest: ReleaseSource<{ web: TargetDecision | NoneDecision }>;
declare const __BUILD_ID__: string;

export const createBeacon = () =>
  new Beacon({
    scope: {
      application: "com.example.notes",
      environment: "production",
      platform: "web",
      distribution: "public-web",
    },
    running: {
      boot: { id: crypto.randomUUID() },
      web: () => ({
        identity: {
          status: "known",
          authority: "com.example.notes",
          domain: "web-artifact",
          value: __BUILD_ID__,
        },
        label: __BUILD_ID__,
        raw: {},
      }),
    },
    routes: {
      web: targetRoute({
        subject: "web",
        source: manifest.select((document) => document.web),
        mechanism: browserReload(),
      }),
    },
  });

export const beacon = createBeacon();

declare module "@priemskiyyy/beacon-svelte" {
  interface Register {
    beacon: ReturnType<typeof createBeacon>;
  }
}
```

`Register` is an interface so that you can merge into it. Without it, utilities accept any route name and give a loosely typed state, so register.

## BeaconProvider

Publish the Beacon once, near the root. The provider is a component. It takes the Beacon and `start` as props and renders its children.

```svelte
<!-- src/Root.svelte -->
<script lang="ts">
  import { BeaconProvider } from "@priemskiyyy/beacon-svelte";
  import type { RegisteredBeacon } from "@priemskiyyy/beacon-svelte";

  import App from "src/App.svelte";

  type Props = { beacon: RegisteredBeacon; start?: boolean };

  const { beacon, start = false }: Props = $props();
</script>

<BeaconProvider {beacon} {start}>
  <App />
</BeaconProvider>
```

The root takes the Beacon as a prop, so the server and the browser share it and differ only in the Beacon they pass and in `start`.

```ts
// src/main.ts
import { mount } from "svelte";

import Root from "src/Root.svelte";
import { beacon } from "src/beacon";

const target = document.getElementById("app");

if (target === null) {
  throw new Error("The page has no #app element.");
}

mount(Root, { target, props: { beacon, start: true } });
```

| Prop       | Meaning                                                                                      |
| ---------- | -------------------------------------------------------------------------------------------- |
| `beacon`   | the registered Beacon to publish to the components below                                     |
| `start`    | `false` by default. When set, the provider holds the observation session while it is mounted |
| `children` | the content that reads the Beacon                                                            |

With `start`, a pre effect calls `beacon.start()` and returns its stop as the cleanup. When the provider is destroyed, that ends only that session. It never disposes the Beacon, and it checks nothing. The effect reads both props, so a new `beacon` or `start` ends the old session first, and starts a new one when `start` is still set.

A pre effect runs before the effects of the children. The session therefore starts before any child's `onMount`, and a check there does not fail with `NOT_STARTED`. Checks are yours:

```svelte
<!-- src/Checker.svelte -->
<script lang="ts">
  import { useBeacon } from "@priemskiyyy/beacon-svelte";
  import { onMount } from "svelte";

  const beacon = useBeacon();

  onMount(() => {
    beacon.current.check({ reason: "startup" });
  });
</script>
```

```svelte
<!-- src/App.svelte -->
<script lang="ts">
  import Checker from "src/Checker.svelte";
  import UpdateBanner from "src/UpdateBanner.svelte";
</script>

<main>
  <Checker />
  <UpdateBanner />
</main>
```

## The utilities

Call a utility while a component initializes, as you would call `getContext`, and not in an event handler or an effect. Each one returns a `ReadableValue`: read `current` in a template, in a `$derived` or in an `$effect`, and Svelte tracks the read. You read it and never write it.

| Utility          | Reads                                                                                                                 |
| ---------------- | --------------------------------------------------------------------------------------------------------------------- |
| `useRoute`       | a route's state by its name, optionally selected, with the types of its own offer and prepared target                 |
| `useRunning`     | what is running per subject. A subject that is not read yet is pending, never an old version                          |
| `useSupport`     | what the support policy says about what runs                                                                          |
| `useTransitions` | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints            |
| `useStatus`      | where the session stands: idle, running, stopped or disposed                                                          |
| `useObservable`  | any other observable of Beacon, such as `beacon.current.route("web").native`                                          |
| `useDisruption`  | registers a participant while mounted; Beacon asks it as it is, so its closures read your state                       |
| `useBeacon`      | the provider's Beacon through `current`, for commands (`reload`, `activate`, `download` and the rest) and for `check` |

### Selectors

Every reading utility takes a selector and an options object: `useRoute(name, selector, { isEqual })`. Without a selector you get the whole snapshot. With one, what depends on `current` runs again only when the selection changes by `isEqual`, which is `Object.is` by default. A selection that `isEqual` calls the same is not assigned, so it keeps its reference.

```svelte
<!-- src/RouteUtilities.svelte -->
<script lang="ts">
  import {
    useRoute,
    useRunning,
    useStatus,
    useSupport,
    useTransitions,
  } from "@priemskiyyy/beacon-svelte";

  const checking = useRoute("web", ({ check }) => check.state === "checking");
  const web = useRunning(({ web }) => web);
  const active = useStatus(({ state }) => state === "running");
  const unsupported = useSupport(({ status }) => status === "unsupported");
  const exhausted = useTransitions(({ latest }) => latest?.exhausted === true);

  const summary = useRoute(
    "web",
    ({ observation }) => ({ status: observation.status }),
    { isEqual: (previous, next) => previous.status === next.status },
  );
</script>

<dl>
  <dt>Checking</dt>
  <dd>{checking.current}</dd>
  <dt>Running</dt>
  <dd>{web.current.state}</dd>
  <dt>Session</dt>
  <dd>{active.current}</dd>
  <dt>Unsupported</dt>
  <dd>{unsupported.current}</dd>
  <dt>Reload keeps failing</dt>
  <dd>{exhausted.current}</dd>
  <dt>Observation</dt>
  <dd>{summary.current.status}</dd>
</dl>
```

A selection that builds a new object every time, like `summary` above, needs an `isEqual`, or what reads it runs on every change of the snapshot. The function takes two values of the selected type, and one typed for another type does not compile. The selection is stored raw, so Svelte does not wrap it in a proxy and it keeps its identity.

`useRoute("elsewhere")` fails to compile, and the state it returns has the offer and prepared target types of that route.

```ts
// src/typos.ts
import { useRoute } from "@priemskiyyy/beacon-svelte";

export const useTypo = () =>
  // @ts-expect-error There is no route named "elsewhere".
  useRoute("elsewhere");
```

### What is read once

The route name, the observable, the selector and the options are read once, when the component initializes. Pass a plain name. For a name that changes, key the component with `{#key}` so that it starts again. The provider's Beacon is the one thing that is followed: a provider whose `beacon` prop changes moves every utility below it to the new Beacon.

The selector runs when Beacon reports a change, and it runs untracked. A `$state` that it reads does not run it again. Select from Beacon's value only, and combine your own state in a `$derived`.

```svelte
<!-- src/Label.svelte -->
<script lang="ts">
  import { useRoute } from "@priemskiyyy/beacon-svelte";

  type Props = { prefix: string };

  const { prefix }: Props = $props();

  const status = useRoute("web", ({ observation }) => observation.status);
  const label = $derived(`${prefix}: ${status.current}`);
</script>

<span>{label}</span>
```

Until the component is mounted, `current` holds the value from before any session. Effects run after mount, and then `current` reads the live value and follows it. The first render, on the server and in the browser, shows the value from before any session.

### Why the utilities untrack

Beacon calls its listeners synchronously, and that can happen inside one of your effects. Two utilities guard against what that would do.

- The provider calls `beacon.start()` inside its effect, and `start` notifies the listeners of the status at once. The provider runs `start` untracked, so whatever your listener reads, such as a `$state`, does not become a dependency of the provider's effect and cannot restart the session.
- A utility reads and assigns its own value when a notification arrives. It does that untracked, so an effect of yours that makes Beacon notify, such as one that reports a checkpoint, does not come to depend on the selection and does not run again when it changes.

```svelte
<!-- src/Ready.svelte -->
<script lang="ts">
  import { useBeacon, useTransitions } from "@priemskiyyy/beacon-svelte";

  const beacon = useBeacon();
  const checkpoints = useTransitions(({ checkpoints }) => checkpoints);

  // Reporting notifies `checkpoints` from inside this effect, and the effect does not depend on it.
  $effect(() => {
    beacon.current.reportReady({ checkpoint: "primary-screen" });
  });
</script>

<p>{checkpoints.current.join(", ")}</p>
```

The effect runs again only when the provider's Beacon changes, since it reads `beacon.current`.

### Commands and checks

A command is an action, so it belongs in an event handler. Take the Beacon with `useBeacon`.

```svelte
<!-- src/UpdateBanner.svelte -->
<script lang="ts">
  import { useBeacon, useRoute } from "@priemskiyyy/beacon-svelte";

  const beacon = useBeacon();
  const observation = useRoute("web", (snapshot) => snapshot.observation);

  const update = async () => {
    if (observation.current.status !== "available") {
      return;
    }

    const outcome = await beacon.current
      .route("web")
      .reload({ offer: observation.current.offer.ref });

    if (outcome.status === "blocked") {
      console.info(outcome.reasons.map((reason) => reason.code));
    }
  };
</script>

{#if observation.current.status === "available"}
  <button onclick={update}>Update</button>
{/if}
```

`useBeacon` returns the provider's Beacon through `current`, typed by the one you registered, and it follows a new one. It throws a `BeaconError` with `INVALID_CONFIGURATION` when no provider is above it, and so does every utility that reads the provider's Beacon.

### Other observables

`useObservable` is what the other utilities are made of. Use it for an observable they do not name, such as a route's native handle. `useObservable(observable, selector, options)` takes the same selector and options.

```svelte
<!-- src/NativeHandle.svelte -->
<script lang="ts">
  import { useBeacon, useObservable } from "@priemskiyyy/beacon-svelte";

  const beacon = useBeacon();
  const native = useObservable(beacon.current.route("web").native);
</script>

<span>{native.current === null ? "closed" : "open"}</span>
```

The observable is read once, so it does not follow a provider that publishes another Beacon. For a route handle you hold, read `handle.state` with `useObservable`. It needs no provider.

## Guarding unsaved work

`useDisruption` registers a participant when the component mounts and unregisters it when the component is destroyed. Beacon reads the participant when it asks, so a closure over a `$state` reads its value at that moment and never goes stale, and a change of state never registers again. When the provider publishes another Beacon, the registration leaves the old one and joins the new one.

```svelte
<!-- src/DraftEditor.svelte -->
<script lang="ts">
  import { useDisruption } from "@priemskiyyy/beacon-svelte";

  type Props = { save: (text: string) => Promise<boolean> };

  const { save }: Props = $props();

  let text = $state("");
  let saved = $state("");
  let locked = $state(false);

  useDisruption({
    name: "draft-editor",
    impacts: ["document-replacement", "javascript-restart"],
    reserve: () => {
      // A write to `$state` is seen at once, so oninput refuses from now on, before Svelte updates the DOM.
      locked = true;

      return {
        status: "reserved",
        settle: async () => {
          if (text === saved) {
            return { status: "ready" };
          }

          if (await save(text)) {
            saved = text;

            return { status: "ready" };
          }

          return { status: "blocked", code: "draft-not-saved" };
        },
        release: () => {
          locked = false;
        },
      };
    },
  });
</script>

<textarea
  value={text}
  readonly={locked}
  oninput={(event) => {
    if (!locked) {
      text = event.currentTarget.value;
    }
  }}></textarea>
```

A reservation a component holds stays valid after the component is destroyed, as long as the service behind it lives. It is released when the command ends, not when the view goes. So a participant that guards real work should be owned by a service, and the utility is a convenient way to register it while a view exists. [Disruptions](disruptions.md) has the whole order of steps.

## Testing

Mount the component under `BeaconProvider` with a real Beacon over the mock source and the test clock, and drive it the way [the testing guide](testing.md) does: answer, check, advance. Reading in a utility never starts a session, so start the Beacon in the test, or pass `start` to the provider. The root component above takes the Beacon as a prop for this reason.

- Compile the tests with the Svelte plugin of Vite, and resolve the `browser` condition so that you get the client build of Svelte, where effects run. Test a server render in a Node environment without that condition.
- Call `flushSync()` after `mount` and after a change. The utilities subscribe in an effect, and the provider starts the session in a pre effect, and both run on that flush.
- A test that uses runes such as `$state` or `$effect` lives in a `.svelte.test.ts` file, so that the Svelte compiler handles it.
- Unmount at the end so the provider ends its session.

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
        subject: "web",
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
import { flushSync, mount, unmount } from "svelte";
import { expect, test } from "vitest";

import Root from "src/Root.svelte";
import { createTestBeacon, deploy } from "src/testBeacon";

test("the banner offers the update once a check finds one", async () => {
  const { beacon, mock } = createTestBeacon();
  const target = document.createElement("div");

  mock.answer({ document: deploy("web-build-b") });

  const app = mount(Root, { target, props: { beacon, start: true } });

  flushSync();
  await beacon.check();
  flushSync();

  expect(target.querySelector("button")?.textContent).toBe("Update");

  unmount(app);
});
```

## Server rendering and hydration

The server and the hydrating render read every observable as it stood before any session, through `getInitial`. On the server that is what `render` prints: the route is `unknown` with `not-checked`, and what runs is `pending`. The markup therefore matches whatever the client has learned by the time it hydrates, even when a boundary hydrates late and the live state has moved on. The live value is read right after mount.

- Design the first render for `unknown` and `pending`: show nothing until the observation is `available`.
- Start the Beacon through the provider, and not before the hydrating render. The provider starts it in a pre effect, before its children mount, so a check in a component's `onMount` does not fail with `NOT_STARTED`.
- Effects never run on the server, so a server render starts nothing, reads nothing and registers no participant. Create the Beacon for each request, and never start it on the server, so that two requests never share a session or a state. In SvelteKit, that means creating it in the script of the root layout, which runs for each request on the server and once in the browser.

```ts
// src/render.ts
import { hydrate } from "svelte";
import { render } from "svelte/server";

import Root from "src/Root.svelte";
import { beacon, createBeacon } from "src/beacon";

export const renderOnTheServer = () => {
  const { body } = render(Root, { props: { beacon: createBeacon() } });

  return body;
};

export const hydrateOnTheClient = (target: HTMLElement) =>
  hydrate(Root, { target, props: { beacon, start: true } });
```

`render` from `svelte/server` is lazy. The component runs when you read `body` or `head`, or when you await the result. A check of the Beacon made right after `render(...)` and before that read sees a component that has not run yet, so read the result first, then assert or log what the render did.

## Types

The registration exposes the types of your Beacon, for props and helpers.

| Type                          | Is                                                           |
| ----------------------------- | ------------------------------------------------------------ |
| `Register`                    | the interface you merge `beacon` into                        |
| `RegisteredBeacon`            | the Beacon you registered                                    |
| `RegisteredRoutes`            | its routes                                                   |
| `RegisteredRouteName`         | the union of its route names                                 |
| `RegisteredRoute<TName>`      | the handle of one route                                      |
| `RegisteredRouteState<TName>` | the snapshot of one route                                    |
| `BeaconProviderProps`         | the props of the provider, with its children                 |
| `SelectorOptions<TSelected>`  | the `{ isEqual }` options of a selector                      |
| `ReadableValue<TValue>`       | what a utility returns: an object with a read-only `current` |

```ts
import type {
  ReadableValue,
  RegisteredRouteState,
} from "@priemskiyyy/beacon-svelte";

export const describeWeb = ({ observation }: RegisteredRouteState<"web">) =>
  observation.status;

export const describeCurrent = (value: ReadableValue<string>) => value.current;
```

The same bindings exist for [React](react.md), [Vue](vue.md) and [Solid](solid.md).

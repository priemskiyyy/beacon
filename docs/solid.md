---
description: "Use Beacon from Solid: register your Beacon, publish it with BeaconProvider, read routes and running facts with typed primitives, guard unsaved work, and render on the server."
---

# Solid

`@priemskiyyy/beacon-solid` is a provider and a set of primitives. The provider holds the observation session while it is mounted, and reading never starts one, checks a route or requests a command. Checks and commands stay explicit, so a component that reads a route can be rendered anywhere without a side effect.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-solid
```

It needs `solid-js` 1.9 or later.

## Register your Beacon

Register it once, next to where you create it. Every primitive then knows the names of your routes and the types of their offers.

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
      web: webBuild({ authority: "com.example.notes", id: __BUILD_ID__ }),
    },
    routes: {
      web: targetRoute({
        source: manifest.select((document) => document.web),
        mechanism: browserReload(),
      }),
    },
  });

export const beacon = createBeacon();

declare module "@priemskiyyy/beacon-solid" {
  interface Register {
    beacon: ReturnType<typeof createBeacon>;
  }
}
```

Without it, the provider still takes your Beacon and the primitives that name no route (`useBeaconStatus`, `useRunning`, `useSupport`, `useTransitions`, `useDisruption`) work, but a primitive that takes a route name fails to compile with the fix as the type it expected: `Register your Beacon: declare module "@priemskiyyy/beacon-solid" { interface Register { beacon: typeof beacon } }`. `Register` is an interface so that you can merge into it.

## BeaconProvider

Publish the Beacon once, near the root. The provider starts the session and ends it again when it is disposed.

```tsx
// src/main.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-solid";
import { render } from "solid-js/web";

import { App } from "src/App";
import { beacon } from "src/beacon";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element.");
}

render(
  () => (
    <BeaconProvider beacon={beacon}>
      <App />
    </BeaconProvider>
  ),
  container,
);
```

| Prop     | Meaning                                                                                                              |
| -------- | -------------------------------------------------------------------------------------------------------------------- |
| `beacon` | the registered Beacon to publish to the tree below                                                                   |
| `start`  | `true` by default: the provider holds the observation session while it is mounted. `false` leaves the session to you |

The provider owns the session. An effect calls `beacon.start()` and returns its stop as the cleanup. When the provider is disposed, that ends only that session. It never disposes the Beacon, and it checks nothing. The effect reads both props, so a new `beacon` or `start` ends the old session, and starts a new one unless `start` is `false`. It calls `start` untracked: `start` notifies the listeners of the status at once, and whatever such a listener reads, such as a signal, does not become a dependency of the provider's effect and cannot restart the session.

Pass `start={false}` when something else owns the session, such as a service of yours that calls `beacon.start()` itself: the provider then publishes the Beacon and starts and stops nothing. Mount one provider per Beacon. `start()` while a session is open answers the same stop, so a second provider on the same Beacon shares that session, and the first of them to unmount ends it for both.

The provider creates its effect before any child exists, and Solid runs effects in the order it created them. The session therefore starts before any child's `onMount`, and a check there does not fail with `NOT_STARTED`. Checks are yours:

```tsx
// src/Checker.tsx
import { useBeacon } from "@priemskiyyy/beacon-solid";
import { onMount } from "solid-js";

export const Checker = () => {
  const beacon = useBeacon();

  onMount(() => {
    beacon().check({ reason: "startup" });
  });

  return null;
};
```

```tsx
// src/App.tsx
import { Checker } from "src/Checker";
import { UpdateBanner } from "src/UpdateBanner";

export const App = () => (
  <main>
    <Checker />
    <UpdateBanner />
  </main>
);
```

## The primitives

Every primitive returns an accessor. Read it by calling it, and Solid tracks the read.

| Primitive         | Reads                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| `useRoute`        | a route's state by its name, optionally selected, with the types of its own offer and prepared target              |
| `useRunning`      | what is running per subject. A subject that is not read yet is pending, never an old version                       |
| `useSupport`      | what the support policy says about what runs                                                                       |
| `useTransitions`  | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints         |
| `useBeaconStatus` | where the session stands: idle, running, stopped or disposed                                                       |
| `useObservable`   | any other observable of Beacon, such as `beacon().route("web").native`                                             |
| `useDisruption`   | registers a participant while mounted; it registers once, so its closures read your signals when asked             |
| `useBeacon`       | an accessor of the provider's Beacon, for commands (`reload`, `activate`, `download` and the rest) and for `check` |

Call them while a component runs, and not in an event handler.

### Selectors

Every reading primitive takes a selector and an options object: `useRoute(name, selector, { isEqual })`. Without a selector you get the whole snapshot. With one, what depends on the accessor runs again only when the selection changes by `isEqual`, which is `Object.is` by default. `isEqual` is the `equals` of the signal behind the accessor, so an equal selection keeps the last one.

```tsx
// src/RoutePrimitives.tsx
import {
  useRoute,
  useRunning,
  useBeaconStatus,
  useSupport,
  useTransitions,
} from "@priemskiyyy/beacon-solid";

export const RoutePrimitives = () => {
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

  return (
    <dl>
      <dt>Checking</dt>
      <dd>{String(checking())}</dd>
      <dt>Running</dt>
      <dd>{web().state}</dd>
      <dt>Session</dt>
      <dd>{String(active())}</dd>
      <dt>Unsupported</dt>
      <dd>{String(unsupported())}</dd>
      <dt>Reload keeps failing</dt>
      <dd>{String(exhausted())}</dd>
      <dt>Observation</dt>
      <dd>{summary().status}</dd>
    </dl>
  );
};
```

A selection that builds a new object every time, like `summary` above, needs an `isEqual`, or what reads it runs on every change of the snapshot. The function takes two values of the selected type, and one typed for another type does not compile.

`useRoute("elsewhere")` fails to compile, and the state it returns has the offer and prepared target types of that route.

```tsx
// src/Typos.tsx
import { useRoute } from "@priemskiyyy/beacon-solid";

export const Typos = () => {
  // @ts-expect-error There is no route named "elsewhere".
  const state = useRoute("elsewhere");

  return <span>{JSON.stringify(state())}</span>;
};
```

### What is read once

The route name and the observable are fixed when the primitive is called. Pass a plain name, and not a signal. The provider's Beacon is the one thing that is followed: a provider whose `beacon` prop changes moves every primitive below it to the new Beacon.

The selector runs untracked. A signal that it reads does not run it again, and does not become a dependency of anything. Select from Beacon's value only, and combine your own signals in a memo.

```tsx
// src/Label.tsx
import { useRoute } from "@priemskiyyy/beacon-solid";
import { createMemo } from "solid-js";

type LabelProps = { prefix: string };

export const Label = (props: LabelProps) => {
  const status = useRoute("web", ({ observation }) => observation.status);
  const label = createMemo(() => `${props.prefix}: ${status()}`);

  return <span>{label()}</span>;
};
```

While the component body runs, an accessor holds the value from before any session. It reads the live value when the component mounts. A read in the body sees the first value, and what you render from it updates after mount.

### When the provider's Beacon changes

The Beacon of the provider is a memo, so `useBeacon()` returns the new Beacon at once. The value behind every other primitive is written by an effect that the primitive creates when you call it, and that effect runs after the memo in the same update. Solid runs effects in the order they were created, so an effect of yours that you create after calling the primitive sees the new Beacon and its selection together.

An effect that you create before the call, or a read inside a `batch` in that update, still sees a value selected from the old Beacon for that one flush. An effect that reads both `useBeacon()` and an accessor and was created first runs twice: first with the new Beacon and the old value, then with both new.

```tsx
// src/SessionLabel.tsx
import { useBeacon, useBeaconStatus } from "@priemskiyyy/beacon-solid";
import { createEffect } from "solid-js";

export const SessionLabel = () => {
  const beacon = useBeacon();
  const state = useBeaconStatus(({ state }) => state);

  // Created after the primitive, so it runs after the primitive's effect and both come from the same Beacon.
  createEffect(() => {
    console.info(beacon().status.get().state, state());
  });

  return <span>{state()}</span>;
};
```

Do not start a command from a run that mixes the two. Call the primitives first in a component and create your own effects after them, or in an effect that acts, read only one of them.

### Commands and checks

A command is an action, so it belongs in an event handler. Take the Beacon with `useBeacon`.

```tsx
// src/UpdateBanner.tsx
import { useBeacon, useRoute } from "@priemskiyyy/beacon-solid";
import { Show } from "solid-js";

export const UpdateBanner = () => {
  const beacon = useBeacon();

  const offer = useRoute("web", ({ observation }) => {
    if (observation.status !== "available") {
      return undefined;
    }

    return observation.offer;
  });

  return (
    <Show when={offer()}>
      {(current) => (
        <button
          onClick={async () => {
            const outcome = await beacon()
              .route("web")
              .reload({ offer: current().ref });

            if (outcome.status === "blocked") {
              console.info(outcome.reasons.map((reason) => reason.code));
            }
          }}
        >
          Update
        </button>
      )}
    </Show>
  );
};
```

`useBeacon` returns an accessor of the provider's Beacon, typed by the one you registered. It throws a `BeaconError` with `INVALID_CONFIGURATION` when no provider is above it, and so does every primitive that reads the provider's Beacon: the message names the primitive you called and the package that has the provider, such as `useRoute needs a BeaconProvider (from @priemskiyyy/beacon-solid) above it.`

### Other observables

`useObservable` is what the other primitives are made of. Use it for an observable they do not name, such as a route's native handle. `useObservable(observable, selector, options)` takes the same selector and options.

```tsx
// src/NativeHandle.tsx
import { useBeacon, useObservable } from "@priemskiyyy/beacon-solid";

export const NativeHandle = () => {
  const beacon = useBeacon();
  const native = useObservable(beacon().route("web").native);

  return <span>{native() === null ? "closed" : "open"}</span>;
};
```

The observable is fixed, so it does not follow a provider that publishes another Beacon. For a route handle you hold, read `handle.state` with `useObservable`. It needs no provider.

## Guarding unsaved work

`useDisruption` registers a participant when the component mounts and unregisters it when the owner is disposed. It registers once, and Beacon asks the participant's closures, so a closure over a signal reads it at that moment and never goes stale. When the provider publishes another Beacon, the registration leaves the old one and joins the new one.

```tsx
// src/DraftEditor.tsx
import { useDisruption } from "@priemskiyyy/beacon-solid";
import { createSignal } from "solid-js";

type DraftEditorProps = { save: (text: string) => Promise<boolean> };

export const DraftEditor = (props: DraftEditorProps) => {
  const [text, setText] = createSignal("");
  const [saved, setSaved] = createSignal("");
  const [locked, setLocked] = createSignal(false);

  useDisruption({
    name: "draft-editor",
    impacts: ["document-replacement", "javascript-restart"],
    reserve: () => {
      // A signal changes at once, and so does the DOM it drives.
      setLocked(true);

      return {
        status: "reserved",
        settle: async () => {
          if (text() === saved()) {
            return { status: "ready" };
          }

          if (await props.save(text())) {
            setSaved(text());

            return { status: "ready" };
          }

          return { status: "blocked", code: "draft-not-saved" };
        },
        release: () => {
          setLocked(false);
        },
      };
    },
  });

  return (
    <textarea
      value={text()}
      readOnly={locked()}
      onInput={(event) => setText(event.currentTarget.value)}
    />
  );
};
```

A reservation an owner holds stays valid after the owner is disposed, as long as the service behind it lives. It is released when the command ends, not when the view goes. So a participant that guards real work should be owned by a service, and the primitive is a convenient way to register it while a view exists. [Disruptions](disruptions.md) has the whole order of steps.

## Testing

Render the component under `BeaconProvider` with a real Beacon over the mock source and the test clock, and drive it the way [the testing guide](testing.md) does: answer, check, advance. Reading in a primitive never starts a session, but the provider does, so a Beacon rendered under it is running. Pass `start={false}` to the provider when a test opens the session itself.

- Run the tests in a DOM environment such as jsdom, with the `browser` and `development` export conditions, and with `solid-js` deduped and inlined (`server.deps.inline`) so that those conditions apply to it. Under plain Node, `solid-js` resolves to its server build, which never runs effects, so no primitive would subscribe.
- Compile the JSX with `vite-plugin-solid`. Test a server render in a Node environment with the plugin's `ssr` option on.
- Solid updates the DOM at once. After `await beacon.check()` the markup is current, with no tick to wait for.
- Keep what `render` returns and call it at the end, so the provider ends its session.

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

```tsx
// src/UpdateBanner.test.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-solid";
import { render } from "solid-js/web";
import { expect, test } from "vitest";

import { UpdateBanner } from "src/UpdateBanner";
import { createTestBeacon, deploy } from "src/testBeacon";

test("the banner offers the update once a check finds one", async () => {
  const { beacon, mock } = createTestBeacon();
  const container = document.createElement("div");

  const dispose = render(
    () => (
      <BeaconProvider beacon={beacon}>
        <UpdateBanner />
      </BeaconProvider>
    ),
    container,
  );

  expect(container.querySelector("button")).toBeNull();

  mock.answer({ document: deploy("web-build-b") });
  await beacon.check();

  expect(container.querySelector("button")?.textContent).toBe("Update");

  dispose();
});
```

## Server rendering and hydration

The server and the hydrating render read every observable as it stood before any session, through `getInitial`. On the server that is what `renderToString` prints: the route is `unknown` with `not-checked`, and what runs is `pending`. The markup therefore matches whatever the client has learned by the time it hydrates, even when a boundary hydrates late and the live state has moved on. The live value is read when a component mounts, and a change of it updates the DOM after hydration.

- Design the first render for `unknown` and `pending`: show nothing until the observation is `available`.
- Let the provider start the Beacon, and not before the hydrating render. It starts it when the tree mounts, before any child's `onMount`, so a check there does not fail with `NOT_STARTED`.
- A server render mounts nothing, so it starts nothing and reads nothing, and the provider starts no session there. Create the Beacon for each request, and never start it yourself on the server, so that two requests never share a session or a state.

```tsx
// src/render.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-solid";
import { hydrate, renderToString } from "solid-js/web";

import { App } from "src/App";
import { beacon, createBeacon } from "src/beacon";

export const renderOnTheServer = () =>
  renderToString(() => (
    <BeaconProvider beacon={createBeacon()}>
      <App />
    </BeaconProvider>
  ));

export const hydrateOnTheClient = (container: HTMLElement) =>
  hydrate(
    () => (
      <BeaconProvider beacon={beacon}>
        <App />
      </BeaconProvider>
    ),
    container,
  );
```

## Types

The registration exposes the types of your Beacon, for props and helpers.

| Type                          | Is                                           |
| ----------------------------- | -------------------------------------------- |
| `Register`                    | the interface you merge `beacon` into        |
| `RegisteredBeacon`            | the Beacon you registered                    |
| `RegisteredRoutes`            | its routes                                   |
| `RegisteredRouteName`         | the union of its route names                 |
| `RegisteredRoute<TName>`      | the handle of one route                      |
| `RegisteredRouteState<TName>` | the snapshot of one route                    |
| `BeaconProviderProps`         | the props of the provider, with its children |
| `SelectorOptions<TSelected>`  | the `{ isEqual }` options of a selector      |

```ts
import type { RegisteredRouteState } from "@priemskiyyy/beacon-solid";

export const describeWeb = ({ observation }: RegisteredRouteState<"web">) =>
  observation.status;
```

The same bindings exist for [React](react.md), [Vue](vue.md) and [Svelte](svelte.md).

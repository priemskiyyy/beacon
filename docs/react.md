---
description: "Use Beacon from React: register your Beacon, publish it with BeaconProvider, read routes and running facts with typed hooks, guard unsaved work, and render on the server."
---

# React

`@priemskiyyy/beacon-react` is a provider and a set of hooks. Reading never starts a session, checks a route or requests a command. Those stay explicit, so a component that reads a route can be rendered anywhere without a side effect.

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react
```

It needs React 19.2 or later.

## Register your Beacon

Register it once, next to where you create it. Every hook then knows the names of your routes and the types of their offers.

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

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: ReturnType<typeof createBeacon>;
  }
}
```

`Register` is an interface so that you can merge into it. Without it, hooks accept any route name and give a loosely typed state, so register.

## BeaconProvider

Publish the Beacon once, near the root.

```tsx
// src/main.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { createRoot } from "react-dom/client";

import { App } from "src/App";
import { beacon } from "src/beacon";

const container = document.getElementById("root");

if (container === null) {
  throw new Error("The page has no #root element.");
}

createRoot(container).render(
  <BeaconProvider beacon={beacon} start>
    <App />
  </BeaconProvider>,
);
```

| Prop     | Meaning                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| `beacon` | the registered Beacon to publish to the tree below                                           |
| `start`  | `false` by default. When set, the provider holds the observation session while it is mounted |

With `start`, a layout effect calls `beacon.start()` and returns its stop as the cleanup. A layout effect runs before the passive effects of the whole tree, so the session is already running when a child's mount effect runs. On unmount it ends only that session. It never disposes the Beacon, and it checks nothing. A new `beacon` or `start` ends the old session and starts the new one.

Checks are yours. A component checks in its own effect, and finds the session running:

```tsx
// src/Checker.tsx
import { useBeacon } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";

export const Checker = () => {
  const beacon = useBeacon();

  useEffect(() => {
    beacon.check({ reason: "startup" });
  }, [beacon]);

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

## The hooks

| Hook             | Reads                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------- |
| `useRoute`       | a route's state by its name, optionally selected, with the types of its own offer and prepared target      |
| `useRunning`     | what is running per subject. A subject that is not read yet is pending, never an old version               |
| `useSupport`     | what the support policy says about what runs                                                               |
| `useTransitions` | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints |
| `useStatus`      | where the session stands: idle, running, stopped or disposed                                               |
| `useObservable`  | any other observable of Beacon, such as `beacon.route("web").native`                                       |
| `useDisruption`  | registers a participant while mounted; Beacon always asks the latest one you passed                        |
| `useBeacon`      | the provider's Beacon, for commands (`reload`, `activate`, `download` and the rest) and for `check`        |

### Selectors

Every reading hook takes a selector and an options object: `useRoute(name, selector, { isEqual })`. Without a selector you get the whole snapshot. With one, the component renders again only when the selection changes by `isEqual`, which is `Object.is` by default.

```tsx
// src/RouteHooks.tsx
import {
  useRoute,
  useRunning,
  useSupport,
  useTransitions,
} from "@priemskiyyy/beacon-react";

export const RouteHooks = () => {
  const checking = useRoute("web", ({ check }) => check.state === "checking");
  const web = useRunning(({ web }) => web);
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
      <dd>{String(checking)}</dd>
      <dt>Running</dt>
      <dd>{web.state}</dd>
      <dt>Unsupported</dt>
      <dd>{String(unsupported)}</dd>
      <dt>Reload keeps failing</dt>
      <dd>{String(exhausted)}</dd>
      <dt>Observation</dt>
      <dd>{summary.status}</dd>
    </dl>
  );
};
```

A selection that builds a new object every time, like `summary` above, needs an `isEqual`, or it renders on every change of the snapshot. Two calls with an equal selection keep the last one's reference.

`useRoute("elsewhere")` fails to compile, and the state it returns has the offer and prepared target types of that route.

```tsx
// src/Typos.tsx
import { useRoute } from "@priemskiyyy/beacon-react";

export const Typos = () => {
  // @ts-expect-error There is no route named "elsewhere".
  const state = useRoute("elsewhere");

  return <span>{JSON.stringify(state)}</span>;
};
```

### Commands and checks

A command is an action, so it belongs in an event handler. Take the Beacon with `useBeacon`.

```tsx
// src/UpdateBanner.tsx
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const observation = useRoute("web", (snapshot) => snapshot.observation);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const outcome = await beacon
      .route("web")
      .reload({ offer: observation.offer.ref });

    if (outcome.status === "blocked") {
      console.info(outcome.reasons.map((reason) => reason.code));
    }
  };

  return <button onClick={update}>Update</button>;
};
```

`useBeacon` returns the provider's Beacon, typed by the one you registered. It throws a `BeaconError` with `INVALID_CONFIGURATION` when no provider is above it.

### Other observables

`useObservable` is what the other hooks are made of. Use it for an observable they do not name, such as a route's native handle. `useObservable(observable, selector, options)` takes the same selector and options.

```tsx
// src/NativeHandle.tsx
import { useBeacon, useObservable } from "@priemskiyyy/beacon-react";

export const NativeHandle = () => {
  const beacon = useBeacon();
  const native = useObservable(beacon.route("web").native);

  return <span>{native === null ? "closed" : "open"}</span>;
};
```

For a route handle you hold, read `handle.state` with `useObservable`.

## Guarding unsaved work

`useDisruption` registers a participant while the component is mounted and unregisters it on unmount. Beacon always calls the latest participant you passed, so a closure over current state never goes stale and a render never registers again.

```tsx
// src/DraftEditor.tsx
import { useDisruption } from "@priemskiyyy/beacon-react";
import { useRef, useState } from "react";

type DraftEditorProps = { save: (text: string) => Promise<boolean> };

export const DraftEditor = ({ save }: DraftEditorProps) => {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState("");
  const locked = useRef(false);

  useDisruption({
    name: "draft-editor",
    impacts: ["document-replacement", "javascript-restart"],
    reserve: () => {
      // A ref, since admission must close now and not on the next render.
      locked.current = true;

      return {
        status: "reserved",
        settle: async () => {
          if (text === saved) {
            return { status: "ready" };
          }

          if (await save(text)) {
            setSaved(text);

            return { status: "ready" };
          }

          return { status: "blocked", code: "draft-not-saved" };
        },
        release: () => {
          locked.current = false;
        },
      };
    },
  });

  return (
    <textarea
      value={text}
      onChange={(event) => {
        if (!locked.current) {
          setText(event.target.value);
        }
      }}
    />
  );
};
```

A reservation a component holds stays valid after the component unmounts, as long as the service behind it lives. It is released when the command ends, not when the view goes. So a participant that guards real work should be owned by a service, and the hook is a convenient way to register it while a view exists. [Disruptions](disruptions.md) has the whole order of steps.

## Strict Mode

Strict Mode runs the provider's effect, cleans it up and runs it again. The result is one session left open, and no check and no command made. A check in your own effect runs twice under Strict Mode in development, and joins the same read.

## Server rendering and hydration

The server and the hydrating render read every observable as it stood before any session, through `getInitial`. On the server that is what `renderToString` prints: the route is `unknown` with `not-checked`, and what runs is `pending`. The markup therefore matches whatever the client has learned by the time it hydrates, even when a boundary hydrates late and the live state has moved on. The live value is read on the render after hydration.

- Design the first render for `unknown` and `pending`: show nothing until the observation is `available`.
- Start the Beacon through the provider, and not before the hydrating render. The provider starts it in a layout effect, so it is running before any child's effect: a check in a component's mount effect does not fail with `NOT_STARTED`.
- A server render starts nothing and reads nothing. Create the Beacon for each request, and never start it on the server, so that two requests never share a session or a state.

```tsx
// src/render.tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";

import { App } from "src/App";
import { beacon, createBeacon } from "src/beacon";

export const renderOnTheServer = () =>
  renderToString(
    <BeaconProvider beacon={createBeacon()}>
      <App />
    </BeaconProvider>,
  );

export const hydrateOnTheClient = (container: HTMLElement) =>
  hydrateRoot(
    container,
    <BeaconProvider beacon={beacon} start>
      <App />
    </BeaconProvider>,
  );
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
import type { RegisteredRouteState } from "@priemskiyyy/beacon-react";

export const describeWeb = ({ observation }: RegisteredRouteState<"web">) =>
  observation.status;
```

## Vue, Solid and Svelte

[Vue](vue.md), [Solid](solid.md) and [Svelte](svelte.md) have bindings with the same names: a provider, `useRoute`, `useRunning`, `useSupport`, `useTransitions`, `useStatus`, `useObservable`, `useDisruption` and `useBeacon`. Each returns what its framework reads: a computed ref in Vue, an accessor in Solid and an object with a `current` property in Svelte. They follow the same rules: reading starts nothing, and the server and the hydrating render read the state as it stood before any session. Each has its own page with the setup, an example of every name and the gotchas of its framework.

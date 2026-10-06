# @priemskiyyy/beacon-react

React bindings for [Beacon](../core): hooks that read route state and what is running, and a provider that holds the observation session while it is mounted. Reading never starts a session, checks a route or requests a command.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react
```

Works with React 18.3 to 19.

## Set up

Register your Beacon once, next to where you create it, so every hook knows its route names and their types:

```ts
// beacon.ts
export const beacon = new Beacon({ scope, running, routes: { web } });

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: typeof beacon;
  }
}
```

Publish it once, near the root. The provider holds the observation session while mounted, and `start={false}` leaves the session to you:

```tsx
import { BeaconProvider } from "@priemskiyyy/beacon-react";

const Root = () => (
  <BeaconProvider beacon={beacon}>
    <UpdateBanner />
  </BeaconProvider>
);
```

## Use

```tsx
import {
  useBeacon,
  useDisruption,
  useRoute,
  useRunning,
} from "@priemskiyyy/beacon-react";

const UpdateBanner = () => {
  const observation = useRoute("web", ({ observation }) => observation);
  const running = useRunning(({ web }) => web);
  const beacon = useBeacon();

  useDisruption({
    name: "draft-editor",
    impacts: ["document-replacement"],
    reserve: () => {
      if (isDirty()) {
        return { status: "blocked", code: "unsaved-draft" };
      }

      return { status: "reserved", release: resume };
    },
  });

  if (observation.status !== "available") {
    return null;
  }

  return (
    <button
      onClick={() =>
        beacon.route("web").reload({ offer: observation.offer.ref })
      }
    >
      Update
    </button>
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
| `useDisruption`   | registers a participant while mounted; Beacon always asks the latest one you passed                        |
| `useObservable`   | any other observable of Beacon, such as `beacon.route("web").native`                                       |
| `useBeacon`       | the provider's Beacon, for commands (`reload`, `activate`, `download`, ...) and for `check`                |

Every selector hook takes `(selector, { isEqual })`: it renders again only when the selection changes by `isEqual` (`Object.is` by default).

## Server rendering

The server and the hydrating render read every observable as it stood before any session (`getInitial`), so the markup matches whatever the client has learned by then, and a boundary that hydrates late still matches. Let the provider start the Beacon, and not before the hydrating render. The provider starts it when the tree mounts, before any child's `useEffect` runs, so a check in a component's mount effect finds the session running. A child's `useLayoutEffect` runs before the provider's, so it does not. A server render starts nothing and reads nothing, and two requests never share a session.

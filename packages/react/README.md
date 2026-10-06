# @priemskiyyy/beacon-react

React bindings for [Beacon](../core): hooks that read route state and what is running, and a provider that can hold the observation session. Reading never starts a session, checks a route or requests a command.

## Installation

```sh
pnpm add @priemskiyyy/beacon @priemskiyyy/beacon-react
```

## Use

```tsx
import {
  BeaconProvider,
  useDisruption,
  useRoute,
  useRunning,
} from "@priemskiyyy/beacon-react";

const Root = () => (
  <BeaconProvider beacon={beacon} start>
    <UpdateBanner />
  </BeaconProvider>
);

const UpdateBanner = () => {
  const web = beacon.route("web");
  const observation = useRoute(web, ({ observation }) => observation);
  const running = useRunning(beacon, ({ web }) => web);

  useDisruption({
    name: "draft-editor",
    impacts: ["document-replacement"],
    reserve: () =>
      isDirty()
        ? { status: "blocked", code: "unsaved-draft" }
        : { status: "reserved", release: resume },
  });

  if (observation.status !== "available") {
    return null;
  }

  return (
    <button onClick={() => web.reload({ offer: observation.offer.ref })}>
      Update
    </button>
  );
};
```

| Export           | Does                                                                                                            |
| ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `BeaconProvider` | publishes a Beacon; with `start` it holds the session while mounted and ends only that session on unmount       |
| `useRoute`       | a route's state from its typed handle, optionally selected, with the types of its own offer and prepared target |
| `useRunning`     | what is running per subject; a subject that is not read yet is pending, never an old version                    |
| `useTransitions` | what the journal knows: its latest intent and what a later boot says about it, and this boot's checkpoints      |
| `useDisruption`  | registers a participant while mounted; Beacon always asks the latest one you passed                             |
| `useBeacon`      | the provider's Beacon                                                                                           |

The server and the hydrating render read state as it stands before any session, so start the Beacon through the provider (after hydration) and not before it.

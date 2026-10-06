import { createComponent, createRoot, mergeProps, untrack } from "solid-js";
import type { Accessor } from "solid-js";

import type { WebBeacon } from "src/beacon.fixture";
import { BeaconProvider } from "src/context/BeaconProvider";

type MountProps = {
  beacon: Accessor<WebBeacon>;
  start?: Accessor<boolean>;
};

// Runs a component body under a provider, the way Solid mounts one (untracked), and hands back what the body made with the root's dispose. A start that is left out is left out of the props, so what a test sees is the provider's own default.
export const mountWithProvider = <TValue>(
  { beacon, start }: MountProps,
  read: () => TValue,
) => {
  const made: Array<{ value: TValue }> = [];

  const dispose = createRoot((disposeRoot) => {
    createComponent(
      BeaconProvider,
      mergeProps(
        {
          get beacon() {
            return beacon();
          },
          get children() {
            made.push({ value: untrack(read) });

            return undefined;
          },
        },
        start === undefined
          ? {}
          : {
              get start() {
                return start();
              },
            },
      ),
    );

    return disposeRoot;
  });

  const [first] = made;

  if (first === undefined) {
    throw new Error("The provider did not render its children.");
  }

  return { value: first.value, dispose };
};

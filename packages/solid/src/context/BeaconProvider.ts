import {
  createComponent,
  createEffect,
  createMemo,
  onCleanup,
  untrack,
} from "solid-js";

import { BeaconContext } from "src/context/BeaconContext";
import type { BeaconProviderProps } from "src/types/BeaconProviderProps";

/**
 * Publishes one Beacon to the tree below. With `start`, it holds the
 * observation session while mounted and ends only that session on unmount;
 * it never disposes the Beacon, and it checks nothing. It follows a new
 * `beacon` or `start`: the old session ends and a new one starts.
 *
 * @example
 * ```tsx
 * <BeaconProvider beacon={beacon} start>
 *   <Application />
 * </BeaconProvider>
 * ```
 */
export const BeaconProvider = (props: BeaconProviderProps) => {
  // An effect never runs on the server, so a server render starts no session, and this one is queued before the effects of the children, so what a child does when it mounts finds the session started.
  createEffect(() => {
    if (!props.start) {
      return;
    }

    const { beacon } = props;

    // Listeners run inside start, and what they read must not become a dependency of this effect.
    onCleanup(untrack(() => beacon.start()));
  });

  return createComponent(BeaconContext.Provider, {
    value: createMemo(() => props.beacon),
    get children() {
      return props.children;
    },
  });
};

import {
  computed,
  defineComponent,
  onBeforeMount,
  onWatcherCleanup,
  provide,
  watch,
} from "vue";

import { BEACON_CONTEXT } from "src/context/BeaconContext";
import type { BeaconProviderProps } from "src/types/BeaconProviderProps";

/**
 * Publishes one Beacon to the components below. With `start`, it holds the
 * observation session while mounted, before any child mounts, and ends only
 * that session on unmount;
 * it never disposes the Beacon, and it checks nothing. A server render
 * starts nothing, and a new `beacon` or `start` prop is followed.
 *
 * @example
 * ```vue
 * <BeaconProvider :beacon="beacon" start>
 *   <Application />
 * </BeaconProvider>
 * ```
 */
export const BeaconProvider = defineComponent(
  (props: BeaconProviderProps, { slots }) => {
    provide(
      BEACON_CONTEXT,
      computed(() => props.beacon),
    );

    // Before the children are created, so what a child does when it mounts finds the session started. Mount hooks never run on the server. The stop of the old session runs before the next one starts.
    onBeforeMount(() => {
      watch(
        [() => props.beacon, () => props.start],
        ([beacon, start]) => {
          if (!start) {
            return;
          }

          onWatcherCleanup(beacon.start());
        },
        { immediate: true, flush: "sync" },
      );
    });

    return () => slots.default?.();
  },
  {
    name: "BeaconProvider",
    props: { beacon: { type: Object, required: true }, start: Boolean },
  },
);

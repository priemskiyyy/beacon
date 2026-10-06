<!--
@component Publishes one Beacon to the components below. With `start`, it holds
the observation session while mounted and ends only that session on unmount; it
never disposes the Beacon, and it checks nothing. A server render starts nothing.
@example `<BeaconProvider {beacon} start><Application /></BeaconProvider>`
-->
<script lang="ts">
  import { setContext, untrack } from "svelte";
  import type { BeaconProviderProps } from "../types/BeaconProviderProps.js";
  import type { ReadableValue } from "../types/ReadableValue.js";
  import type { RegisteredBeacon } from "../types/Register.js";
  import { BEACON_CONTEXT } from "./BeaconContext.js";

  const props: BeaconProviderProps = $props();

  setContext(BEACON_CONTEXT, {
    get current() {
      return props.beacon;
    },
  } satisfies ReadableValue<RegisteredBeacon>);

  // Effects never run on the server, so a server render starts nothing. A new beacon or start ends the old session first.
  $effect(() => {
    const { beacon, start = false } = props;

    if (!start) {
      return;
    }

    // Listeners run inside start, and what they read must not become a dependency of this effect.
    return untrack(() => beacon.start());
  });
</script>

{@render props.children?.()}

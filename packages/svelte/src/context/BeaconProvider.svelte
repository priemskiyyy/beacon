<!--
@component Publishes one Beacon to the components below and holds its
observation session while mounted: it starts the session before any child
mounts and ends only that session on unmount. `start={false}` leaves the
session to the application. It never disposes the Beacon, and it checks
nothing. A server render starts nothing.
@example `<BeaconProvider {beacon}><Application /></BeaconProvider>`
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

  // Effects never run on the server, so a server render starts nothing. A pre effect runs before the children's, so what a child does when it mounts finds the session started. A new beacon or start ends the old session first.
  $effect.pre(() => {
    const { beacon, start = true } = props;

    if (!start) {
      return;
    }

    // Listeners run inside start, and what they read must not become a dependency of this effect.
    return untrack(() => beacon.start());
  });
</script>

{@render props.children?.()}

<script lang="ts">
  import BeaconProvider from "../context/BeaconProvider.svelte";
  import type { RegisteredBeacon } from "../types/Register.js";
  import View from "./View.fixture.svelte";

  type Props = {
    beacon: RegisteredBeacon;
    start?: boolean | undefined;
    read: () => void;
  };

  const props: Props = $props();

  // The tests of the utilities open the session themselves unless they say `start`, so this harness is idle by default; the provider's own tests render it with no start.
  const start = $derived(props.start ?? false);
</script>

<BeaconProvider beacon={props.beacon} {start}>
  <View read={props.read} />
</BeaconProvider>

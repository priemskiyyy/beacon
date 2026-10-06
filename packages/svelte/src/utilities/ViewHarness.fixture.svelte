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
</script>

<BeaconProvider beacon={props.beacon} start={props.start}>
  <View read={props.read} />
</BeaconProvider>

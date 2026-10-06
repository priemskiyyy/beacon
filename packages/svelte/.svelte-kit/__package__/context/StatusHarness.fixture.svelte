<script lang="ts">
  import type { RegisteredBeacon } from "../types/Register.js";
  import BeaconProvider from "./BeaconProvider.svelte";
  import Status from "./Status.fixture.svelte";

  type Props = {
    beacon: RegisteredBeacon;
    seen?: string[] | undefined;
  };

  const props: Props = $props();
</script>

<BeaconProvider beacon={props.beacon} start>
  <Status seen={props.seen} />
</BeaconProvider>

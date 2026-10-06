<script lang="ts">
  import type { RegisteredBeacon } from "../types/Register.js";
  import BeaconProvider from "./BeaconProvider.svelte";
  import Checker from "./Checker.fixture.svelte";

  type Props = {
    beacon: RegisteredBeacon;
    outcomes: string[];
  };

  const props: Props = $props();
</script>

<BeaconProvider beacon={props.beacon}>
  <Checker beacon={props.beacon} outcomes={props.outcomes} />
</BeaconProvider>

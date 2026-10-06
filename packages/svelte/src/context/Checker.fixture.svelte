<script lang="ts">
  import { onMount } from "svelte";
  import type { RegisteredBeacon } from "../types/Register.js";

  type Props = {
    beacon: RegisteredBeacon;
    outcomes: string[];
  };

  const props: Props = $props();

  // What an application does when a screen mounts.
  onMount(() => {
    props.beacon
      .check()
      .then(({ routes }) => props.outcomes.push(routes.web.status));
  });
</script>

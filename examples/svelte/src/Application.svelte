<script lang="ts">
  import { BeaconProvider, useObservable } from "@priemskiyyy/beacon-svelte";

  import Page from "src/components/Page/Page.svelte";
  import { useLab } from "src/hooks/useLab";

  const lab = useLab();
  const boot = useObservable(lab.boot);
</script>

<!-- A new document is a new tree, as a page load would be. -->
{#key boot.current.number}
  <BeaconProvider beacon={boot.current.beacon} start>
    <Page />
  </BeaconProvider>
{/key}

<script lang="ts">
  import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
  import EmptyState from "src/components/EmptyState/EmptyState.svelte";
  import Icon from "src/components/Icon/Icon.svelte";
  import Panel from "src/components/Panel/Panel.svelte";
  import TimelineRow from "src/components/Timeline/TimelineRow.svelte";
  import { useEventLog } from "src/hooks/useEventLog";
  import { useLab } from "src/hooks/useLab";

  const lab = useLab();
  const entries = useEventLog(lab.timeline);
</script>

<Panel
  title="Timeline"
  icon="history"
  shows="Beacon's diagnostics, the journal's changes and what the world did, newest first. A diagnostic names counts and codes, never a manifest or a URL."
>
  {#snippet aside()}
    <button
      type="button"
      onclick={() => lab.timeline.clear()}
      class={buttonStyles({ size: "small", variant: "ghost" })}
    >
      <Icon name="trash" size={14} />
      Clear
    </button>
  {/snippet}
  {#if entries.current.length === 0}
    <EmptyState
      icon="history"
      title="Nothing recorded yet"
      description="Check, publish or reload, and each step appears here."
    />
  {:else}
    <ol
      aria-label="Timeline entries"
      class="flex max-h-[28rem] flex-col divide-y divide-zinc-200/70 overflow-y-auto text-sm dark:divide-zinc-800"
    >
      {#each entries.current as entry (entry.id)}
        <TimelineRow {entry} />
      {/each}
    </ol>
  {/if}
</Panel>

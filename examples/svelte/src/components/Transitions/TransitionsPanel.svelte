<script lang="ts">
  import type { Reconciliation } from "@priemskiyyy/beacon";
  import { useBeacon, useTransitions } from "@priemskiyyy/beacon-svelte";

  import { formatIdentity } from "example-shared/formatting/formatIdentity";
  import { RECONCILIATION_LABELS } from "example-shared/lab/constants/labels";
  import {
    JOURNAL_TONES,
    RECONCILIATION_TONES,
  } from "example-shared/ui/constants/tones";
  import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
  import Badge from "src/components/Badge/Badge.svelte";
  import Fact from "src/components/Fact/Fact.svelte";
  import Icon from "src/components/Icon/Icon.svelte";
  import Panel from "src/components/Panel/Panel.svelte";

  const CHECKPOINT = "primary-screen";

  const beacon = useBeacon();
  const transitions = useTransitions();

  const formatIntent = ({ intent }: Reconciliation) => {
    const target = formatIdentity(
      intent.target ?? { status: "unknown", reason: "no-target" },
    );

    return `${intent.command} on ${intent.route} from ${intent.boot.id}, aimed at ${target}`;
  };

  const handleReadyPress = () => {
    beacon.current.reportReady({ checkpoint: CHECKPOINT });
  };

  const handleClearPress = () => {
    beacon.current.clearJournal();
  };
</script>

<Panel
  title="Transitions"
  icon="notebook"
  shows="The intent written before a reload, and what the next boot says about it. It is never proof that anything was installed or that the boot is healthy."
>
  {#snippet aside()}
    <button
      type="button"
      onclick={handleReadyPress}
      class={buttonStyles({ size: "small" })}
    >
      <Icon name="flag" size={14} />
      Report ready
    </button>
    <button
      type="button"
      onclick={handleClearPress}
      class={buttonStyles({ size: "small", variant: "ghost" })}
    >
      <Icon name="trash" size={14} />
      Clear journal
    </button>
  {/snippet}
  <dl class="grid gap-2 sm:grid-cols-2">
    <Fact
      term="Journal"
      hint="Off without storage; degraded when a read or a write failed."
    >
      <Badge tone={JOURNAL_TONES[transitions.current.journal]}>
        {transitions.current.journal}
      </Badge>
    </Fact>
    <Fact
      term="Latest intent"
      hint="Written before the reload, from the boot that asked for it."
    >
      {#if transitions.current.latest === null}
        none recorded
      {:else}
        {formatIntent(transitions.current.latest)}
      {/if}
    </Fact>
    <Fact
      term="Outcome"
      hint="What this boot's running facts say about the intent."
    >
      {#if transitions.current.latest === null}
        nothing to reconcile
      {:else}
        {@const { outcome } = transitions.current.latest}
        <span class="flex flex-col items-start gap-1">
          <Badge tone={RECONCILIATION_TONES[outcome]}>{outcome}</Badge>
          <span>{RECONCILIATION_LABELS[outcome]}</span>
        </span>
      {/if}
    </Fact>
    <Fact
      term="Unreached boots"
      hint="Boots in a row that left the same target unreached, against the budget."
    >
      {#if transitions.current.latest === null}
        0
      {:else}
        {@const { attempts, exhausted } = transitions.current.latest}
        <span class="flex flex-wrap items-center gap-2">
          {attempts}
          {#if exhausted}
            <Badge tone="danger">budget spent</Badge>
          {/if}
        </span>
      {/if}
    </Fact>
    <Fact
      term="Checkpoints"
      hint="What the application reported in this boot; without one, readiness is unknown."
    >
      {transitions.current.checkpoints.length === 0
        ? "none reported"
        : transitions.current.checkpoints.join(", ")}
    </Fact>
    <Fact
      term="Dropped intents"
      hint="Older intents the journal let go of, so that coverage is visibly gone."
    >
      {transitions.current.dropped}
    </Fact>
  </dl>
</Panel>

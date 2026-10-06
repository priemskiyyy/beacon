<script lang="ts">
  import type { Evidence, Observation, RouteBody } from "@priemskiyyy/beacon";

  import { formatClockTime } from "example-shared/formatting/formatClockTime";
  import { FRESHNESS_TONES } from "example-shared/ui/constants/tones";
  import Badge from "src/components/Badge/Badge.svelte";
  import Fact from "src/components/Fact/Fact.svelte";

  type Props = { observation: Observation<string, RouteBody> };

  const { observation }: Props = $props();

  const formatRevision = (revision: { kind: string; value: string } | null) => {
    if (revision === null) {
      return "no revision";
    }

    return `${revision.kind} revision ${revision.value}`;
  };

  const formatExpiry = ({ expiresAt }: Evidence) => {
    if (expiresAt === null) {
      return "never expires";
    }

    return `expires ${formatClockTime(expiresAt)}`;
  };
</script>

{#if observation.status === "unknown"}
  <Fact
    term="Evidence"
    hint="Nothing is backed until an authority answers; unknown is never an old version."
  >
    none yet
  </Fact>
{:else}
  {@const { evidence } = observation}
  <Fact
    term="Evidence"
    hint="Goes stale by time alone: a failed check leaves it in place and ages it."
  >
    <span class="flex flex-col items-start gap-1">
      <Badge tone={FRESHNESS_TONES[evidence.freshness]}>
        {evidence.freshness}
      </Badge>
      <span>{evidence.source} over {evidence.origin}</span>
      <span>{formatExpiry(evidence)}, {formatRevision(evidence.revision)}</span>
    </span>
  </Fact>
{/if}

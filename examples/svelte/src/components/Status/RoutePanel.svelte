<script lang="ts">
  import type { OperationState } from "@priemskiyyy/beacon";
  import { useRoute, useStatus } from "@priemskiyyy/beacon-svelte";

  import { formatCheck } from "example-shared/formatting/formatCheck";
  import { formatClockTime } from "example-shared/formatting/formatClockTime";
  import { formatObservation } from "example-shared/formatting/formatObservation";
  import {
    CHECK_TONES,
    OBSERVATION_TONES,
    OPERATION_TONES,
    SESSION_TONES,
  } from "example-shared/ui/constants/tones";
  import Badge from "src/components/Badge/Badge.svelte";
  import Fact from "src/components/Fact/Fact.svelte";
  import Panel from "src/components/Panel/Panel.svelte";
  import EvidenceFact from "src/components/Status/EvidenceFact.svelte";

  const status = useStatus();
  const check = useRoute("web", (snapshot) => snapshot.check);
  const observation = useRoute("web", (snapshot) => snapshot.observation);
  const operation = useRoute("web", (snapshot) => snapshot.operation);

  const describeOperation = (state: OperationState) => {
    if (state.state === "idle") {
      return "";
    }

    if (state.state === "indeterminate") {
      return `${state.command}, operation ${state.operation.id}, ${state.reason}`;
    }

    return `${state.command}, operation ${state.operation.id}`;
  };
</script>

<Panel
  title="Route web"
  icon="route"
  shows="Four dimensions that never rewrite each other: the check, the accepted observation, what is prepared and the running operation."
>
  <dl class="grid gap-2 sm:grid-cols-2">
    <Fact
      term="Session"
      hint="Held by the provider while it is mounted; a check needs it."
    >
      <Badge tone={SESSION_TONES[status.current.state]}>
        {status.current.state}
      </Badge>
    </Fact>
    <Fact
      term="Check"
      hint="Whether the last attempt was answered. A failure never erases what was accepted."
    >
      <span class="flex flex-col items-start gap-1">
        <Badge tone={CHECK_TONES[check.current.state]}>
          {check.current.state}
        </Badge>
        <span>{formatCheck(check.current)}</span>
      </span>
    </Fact>
    <Fact
      term="Observation"
      hint="What the authority said for this route. None is not proof that no release exists."
    >
      <span class="flex flex-col items-start gap-1">
        <Badge tone={OBSERVATION_TONES[observation.current.status]}>
          {observation.current.status}
        </Badge>
        <span>{formatObservation(observation.current)}</span>
      </span>
    </Fact>
    <EvidenceFact observation={observation.current} />
    <Fact
      term="Operation"
      hint="A reload that replaces the document stays unresolved until a boot or an acknowledgement."
    >
      <span class="flex flex-col items-start gap-1">
        <Badge tone={OPERATION_TONES[operation.current.state]}>
          {operation.current.state}
        </Badge>
        {#if operation.current.state !== "idle"}
          <span>{describeOperation(operation.current)}</span>
        {/if}
      </span>
    </Fact>
    <Fact
      term="Last answer"
      hint="When Beacon accepted the answer it judges the route by."
    >
      {observation.current.status === "unknown"
        ? "none yet"
        : formatClockTime(observation.current.evidence.receivedAt)}
    </Fact>
  </dl>
</Panel>

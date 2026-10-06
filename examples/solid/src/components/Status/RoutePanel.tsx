import { useRoute, useBeaconStatus } from "@priemskiyyy/beacon-solid";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { formatCheck } from "example-shared/formatting/formatCheck";
import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatObservation } from "example-shared/formatting/formatObservation";
import {
  CHECK_TONES,
  OBSERVATION_TONES,
  OPERATION_TONES,
  SESSION_TONES,
} from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";
import { EvidenceFact } from "src/components/Status/EvidenceFact";

export const RoutePanel: Component = () => {
  const status = useBeaconStatus();
  const check = useRoute("web", (route) => route.check);
  const observation = useRoute("web", (route) => route.observation);
  const operation = useRoute("web", (route) => route.operation);

  const describeOperation = () => {
    const current = operation();

    if (current.state === "idle") {
      return undefined;
    }

    if (current.state === "indeterminate") {
      return `${current.command}, operation ${current.operation.id}, ${current.reason}`;
    }

    return `${current.command}, operation ${current.operation.id}`;
  };

  const lastAnswer = () => {
    const current = observation();

    if (current.status === "unknown") {
      return "none yet";
    }

    return formatClockTime(current.evidence.receivedAt);
  };

  return (
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
          <Badge tone={SESSION_TONES[status().state]}>{status().state}</Badge>
        </Fact>
        <Fact
          term="Check"
          hint="Whether the last attempt was answered. A failure never erases what was accepted."
        >
          <span class="flex flex-col items-start gap-1">
            <Badge tone={CHECK_TONES[check().state]}>{check().state}</Badge>
            <span>{formatCheck(check())}</span>
          </span>
        </Fact>
        <Fact
          term="Observation"
          hint="What the authority said for this route. None is not proof that no release exists."
        >
          <span class="flex flex-col items-start gap-1">
            <Badge tone={OBSERVATION_TONES[observation().status]}>
              {observation().status}
            </Badge>
            <span>{formatObservation(observation())}</span>
          </span>
        </Fact>
        <EvidenceFact observation={observation()} />
        <Fact
          term="Operation"
          hint="A reload that replaces the document stays unresolved until a boot or an acknowledgement."
        >
          <span class="flex flex-col items-start gap-1">
            <Badge tone={OPERATION_TONES[operation().state]}>
              {operation().state}
            </Badge>
            <Show when={describeOperation()}>
              {(description) => <span>{description()}</span>}
            </Show>
          </span>
        </Fact>
        <Fact
          term="Last answer"
          hint="When Beacon accepted the answer it judges the route by."
        >
          {lastAnswer()}
        </Fact>
      </dl>
    </Panel>
  );
};

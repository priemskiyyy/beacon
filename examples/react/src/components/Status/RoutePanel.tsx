import { Path } from "@phosphor-icons/react";
import { useRoute, useStatus } from "@priemskiyyy/beacon-react";
import type React from "react";

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

export const RoutePanel: React.FunctionComponent = () => {
  const status = useStatus();
  const { check, observation, operation } = useRoute("web");

  return (
    <Panel
      title="Route web"
      icon={Path}
      shows="Four dimensions that never rewrite each other: the check, the accepted observation, what is prepared and the running operation."
    >
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact
          term="Session"
          hint="Held by the provider while it is mounted; a check needs it."
        >
          <Badge tone={SESSION_TONES[status.state]}>{status.state}</Badge>
        </Fact>
        <Fact
          term="Check"
          hint="Whether the last attempt was answered. A failure never erases what was accepted."
        >
          <span className="flex flex-col items-start gap-1">
            <Badge tone={CHECK_TONES[check.state]}>{check.state}</Badge>
            <span>{formatCheck(check)}</span>
          </span>
        </Fact>
        <Fact
          term="Observation"
          hint="What the authority said for this route. None is not proof that no release exists."
        >
          <span className="flex flex-col items-start gap-1">
            <Badge tone={OBSERVATION_TONES[observation.status]}>
              {observation.status}
            </Badge>
            <span>{formatObservation(observation)}</span>
          </span>
        </Fact>
        <EvidenceFact observation={observation} />
        <Fact
          term="Operation"
          hint="A reload that replaces the document stays unresolved until a boot or an acknowledgement."
        >
          <span className="flex flex-col items-start gap-1">
            <Badge tone={OPERATION_TONES[operation.state]}>
              {operation.state}
            </Badge>
            {operation.state === "idle" ? null : (
              <span>
                {operation.command}, operation {operation.operation.id}
                {operation.state === "indeterminate"
                  ? `, ${operation.reason}`
                  : ""}
              </span>
            )}
          </span>
        </Fact>
        <Fact
          term="Last answer"
          hint="When Beacon accepted the answer it judges the route by."
        >
          {observation.status === "unknown"
            ? "none yet"
            : formatClockTime(observation.evidence.receivedAt)}
        </Fact>
      </dl>
    </Panel>
  );
};

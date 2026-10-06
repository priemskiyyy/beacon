import type { Observation, RouteBody } from "@priemskiyyy/beacon";
import type React from "react";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { FRESHNESS_TONES } from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { Fact } from "src/components/Fact/Fact";

type EvidenceFactProps = { observation: Observation<string, RouteBody> };

const formatRevision = (revision: { kind: string; value: string } | null) => {
  if (revision === null) {
    return "no revision";
  }

  return `${revision.kind} revision ${revision.value}`;
};

export const EvidenceFact: React.FunctionComponent<EvidenceFactProps> = ({
  observation,
}) => {
  if (observation.status === "unknown") {
    return (
      <Fact
        term="Evidence"
        hint="Nothing is backed until an authority answers; unknown is never an old version."
      >
        none yet
      </Fact>
    );
  }

  const { evidence } = observation;

  return (
    <Fact
      term="Evidence"
      hint="Goes stale by time alone: a failed check leaves it in place and ages it."
    >
      <span className="flex flex-col items-start gap-1">
        <Badge tone={FRESHNESS_TONES[evidence.freshness]}>
          {evidence.freshness}
        </Badge>
        <span>
          {evidence.source} over {evidence.origin}
        </span>
        <span>
          {evidence.expiresAt === null
            ? "never expires"
            : `expires ${formatClockTime(evidence.expiresAt)}`}
          , {formatRevision(evidence.revision)}
        </span>
      </span>
    </Fact>
  );
};

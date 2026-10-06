import type { Observation, RouteBody } from "@priemskiyyy/beacon";
import { Show } from "solid-js";
import type { Component } from "solid-js";

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

export const EvidenceFact: Component<EvidenceFactProps> = (props) => {
  const evidence = () => {
    if (props.observation.status === "unknown") {
      return undefined;
    }

    return props.observation.evidence;
  };

  const describeExpiry = (expiresAt: number | null) => {
    if (expiresAt === null) {
      return "never expires";
    }

    return `expires ${formatClockTime(expiresAt)}`;
  };

  return (
    <Show
      when={evidence()}
      fallback={
        <Fact
          term="Evidence"
          hint="Nothing is backed until an authority answers; unknown is never an old version."
        >
          none yet
        </Fact>
      }
    >
      {(current) => (
        <Fact
          term="Evidence"
          hint="Goes stale by time alone: a failed check leaves it in place and ages it."
        >
          <span class="flex flex-col items-start gap-1">
            <Badge tone={FRESHNESS_TONES[current().freshness]}>
              {current().freshness}
            </Badge>
            <span>
              {current().source} over {current().origin}
            </span>
            <span>
              {describeExpiry(current().expiresAt)},{" "}
              {formatRevision(current().revision)}
            </span>
          </span>
        </Fact>
      )}
    </Show>
  );
};

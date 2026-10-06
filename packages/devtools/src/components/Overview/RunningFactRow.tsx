import type { RunningFact, RunningSubject } from "@priemskiyyy/beacon";

import { StateBadge } from "src/components/shared/StateBadge";
import { formatDateTime } from "src/formatting/formatDateTime";
import { formatIdentity } from "src/formatting/formatIdentity";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import { formatRaw } from "src/formatting/formatRaw";
import { assertUnreachable } from "src/utils/assertUnreachable";

type RunningFactRowProps = {
  subject: RunningSubject;
  fact: RunningFact;
  /** Off by default: the raw values a platform reported may hold what the application would not print. */
  showRaw: boolean;
};

/** What one kind of code is known to be running: pending, known with its identity, unreadable, or not read at all. */
export const RunningFactRow = (props: RunningFactRowProps) => (
  <li class="fact" data-subject={props.subject}>
    <div class="fact-head">
      <code>{props.subject}</code>
      <StateBadge state={props.fact.state}>{props.fact.state}</StateBadge>
    </div>
    {(() => {
      const { fact } = props;

      if (fact.state === "unconfigured") {
        return <small class="muted">No reader is configured.</small>;
      }

      if (fact.state === "pending") {
        return <small class="muted">The reader has not answered yet.</small>;
      }

      if (fact.state === "failed") {
        return (
          <small>
            {fact.error.code}: {formatOptionalText(fact.error.message)}
          </small>
        );
      }

      if (fact.state === "known") {
        return (
          <>
            <small>
              {formatIdentity(fact.release.identity)} · label{" "}
              {formatOptionalText(fact.release.label)} · read{" "}
              {formatDateTime(fact.readAt)}
            </small>
            {props.showRaw ? (
              <pre class="raw">{formatRaw(fact.release.raw)}</pre>
            ) : (
              <small class="muted">Raw values hidden.</small>
            )}
          </>
        );
      }

      return assertUnreachable(fact);
    })()}
  </li>
);

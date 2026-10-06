import { Flag, Notebook, Trash } from "@phosphor-icons/react";
import { useBeacon, useTransitions } from "@priemskiyyy/beacon-react";
import type React from "react";

import { formatIdentity } from "example-shared/formatting/formatIdentity";
import { RECONCILIATION_LABELS } from "example-shared/lab/constants/labels";
import {
  JOURNAL_TONES,
  RECONCILIATION_TONES,
} from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { Badge } from "src/components/Badge/Badge";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";

const CHECKPOINT = "primary-screen";

export const TransitionsPanel: React.FunctionComponent = () => {
  const beacon = useBeacon();
  const { journal, latest, dropped, checkpoints } = useTransitions();

  const handleReadyPress = () => {
    beacon.reportReady({ checkpoint: CHECKPOINT });
  };

  const handleClearPress = () => {
    beacon.clearJournal();
  };

  return (
    <Panel
      title="Transitions"
      icon={Notebook}
      shows="The intent written before a reload, and what the next boot says about it. It is never proof that anything was installed or that the boot is healthy."
      aside={
        <>
          <button
            type="button"
            onClick={handleReadyPress}
            className={buttonStyles({ size: "small" })}
          >
            <Flag aria-hidden="true" size={14} weight="bold" />
            Report ready
          </button>
          <button
            type="button"
            onClick={handleClearPress}
            className={buttonStyles({ size: "small", variant: "ghost" })}
          >
            <Trash aria-hidden="true" size={14} weight="bold" />
            Clear journal
          </button>
        </>
      }
    >
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact
          term="Journal"
          hint="Off without storage; degraded when a read or a write failed."
        >
          <Badge tone={JOURNAL_TONES[journal]}>{journal}</Badge>
        </Fact>
        <Fact
          term="Latest intent"
          hint="Written before the reload, from the boot that asked for it."
        >
          {latest === null
            ? "none recorded"
            : `${latest.intent.command} on ${latest.intent.route} from ${latest.intent.boot.id}, aimed at ${formatIdentity(latest.intent.target ?? { status: "unknown", reason: "no-target" })}`}
        </Fact>
        <Fact
          term="Outcome"
          hint="What this boot's running facts say about the intent."
        >
          {latest === null ? (
            "nothing to reconcile"
          ) : (
            <span className="flex flex-col items-start gap-1">
              <Badge tone={RECONCILIATION_TONES[latest.outcome]}>
                {latest.outcome}
              </Badge>
              <span>{RECONCILIATION_LABELS[latest.outcome]}</span>
            </span>
          )}
        </Fact>
        <Fact
          term="Unreached boots"
          hint="Boots in a row that left the same target unreached, against the budget."
        >
          {latest === null ? (
            "0"
          ) : (
            <span className="flex flex-wrap items-center gap-2">
              {latest.attempts}
              {latest.exhausted ? (
                <Badge tone="danger">budget spent</Badge>
              ) : null}
            </span>
          )}
        </Fact>
        <Fact
          term="Checkpoints"
          hint="What the application reported in this boot; without one, readiness is unknown."
        >
          {checkpoints.length === 0 ? "none reported" : checkpoints.join(", ")}
        </Fact>
        <Fact
          term="Dropped intents"
          hint="Older intents the journal let go of, so that coverage is visibly gone."
        >
          {dropped}
        </Fact>
      </dl>
    </Panel>
  );
};

import { useBeacon, useTransitions } from "@priemskiyyy/beacon-solid";
import { Show } from "solid-js";
import type { Component } from "solid-js";

import { formatIdentity } from "example-shared/formatting/formatIdentity";
import { RECONCILIATION_LABELS } from "example-shared/lab/constants/labels";
import {
  JOURNAL_TONES,
  RECONCILIATION_TONES,
} from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { Badge } from "src/components/Badge/Badge";
import { Fact } from "src/components/Fact/Fact";
import { Icon } from "src/components/Icon/Icon";
import { Panel } from "src/components/Panel/Panel";

const CHECKPOINT = "primary-screen";

export const TransitionsPanel: Component = () => {
  const beacon = useBeacon();
  const journal = useTransitions((transitions) => transitions.journal);
  const latest = useTransitions((transitions) => transitions.latest);
  const dropped = useTransitions((transitions) => transitions.dropped);
  const checkpoints = useTransitions((transitions) => transitions.checkpoints);

  const handleReadyPress = () => {
    beacon().reportReady({ checkpoint: CHECKPOINT });
  };

  const handleClearPress = () => {
    beacon().clearJournal();
  };

  const describeIntent = () => {
    const current = latest();

    if (current === null) {
      return "none recorded";
    }

    const { intent } = current;

    return `${intent.command} on ${intent.route} from ${intent.boot.id}, aimed at ${formatIdentity(intent.target ?? { status: "unknown", reason: "no-target" })}`;
  };

  const describeCheckpoints = () => {
    if (checkpoints().length === 0) {
      return "none reported";
    }

    return checkpoints().join(", ");
  };

  return (
    <Panel
      title="Transitions"
      icon="notebook"
      shows="The intent written before a reload, and what the next boot says about it. It is never proof that anything was installed or that the boot is healthy."
      aside={
        <>
          <button
            type="button"
            onClick={handleReadyPress}
            class={buttonStyles({ size: "small" })}
          >
            <Icon name="flag" size={14} />
            Report ready
          </button>
          <button
            type="button"
            onClick={handleClearPress}
            class={buttonStyles({ size: "small", variant: "ghost" })}
          >
            <Icon name="trash" size={14} />
            Clear journal
          </button>
        </>
      }
    >
      <dl class="grid gap-2 sm:grid-cols-2">
        <Fact
          term="Journal"
          hint="Off without storage; degraded when a read or a write failed."
        >
          <Badge tone={JOURNAL_TONES[journal()]}>{journal()}</Badge>
        </Fact>
        <Fact
          term="Latest intent"
          hint="Written before the reload, from the boot that asked for it."
        >
          {describeIntent()}
        </Fact>
        <Fact
          term="Outcome"
          hint="What this boot's running facts say about the intent."
        >
          <Show when={latest()} fallback="nothing to reconcile">
            {(current) => (
              <span class="flex flex-col items-start gap-1">
                <Badge tone={RECONCILIATION_TONES[current().outcome]}>
                  {current().outcome}
                </Badge>
                <span>{RECONCILIATION_LABELS[current().outcome]}</span>
              </span>
            )}
          </Show>
        </Fact>
        <Fact
          term="Unreached boots"
          hint="Boots in a row that left the same target unreached, against the budget."
        >
          <Show when={latest()} fallback="0">
            {(current) => (
              <span class="flex flex-wrap items-center gap-2">
                {current().attempts}
                <Show when={current().exhausted}>
                  <Badge tone="danger">budget spent</Badge>
                </Show>
              </span>
            )}
          </Show>
        </Fact>
        <Fact
          term="Checkpoints"
          hint="What the application reported in this boot; without one, readiness is unknown."
        >
          {describeCheckpoints()}
        </Fact>
        <Fact
          term="Dropped intents"
          hint="Older intents the journal let go of, so that coverage is visibly gone."
        >
          {dropped()}
        </Fact>
      </dl>
    </Panel>
  );
};

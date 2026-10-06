import type { TransitionState } from "@priemskiyyy/beacon";
import { For, Show } from "solid-js";

import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { StateBadge } from "src/components/shared/StateBadge";
import { formatDateTime } from "src/formatting/formatDateTime";
import { formatOptionalIdentity } from "src/formatting/formatOptionalIdentity";
import { boundText } from "src/utils/boundText";

type TransitionsSectionProps = { transitions: TransitionState };

/** What the journal knows: its own state, the latest intent and what the running facts say about it, and this boot's readiness checkpoints. */
export const TransitionsSection = (props: TransitionsSectionProps) => (
  <Section title="Transitions">
    <div class="fact-head">
      <StateBadge state={props.transitions.journal}>
        journal {props.transitions.journal}
      </StateBadge>
      <small class="muted">snapshot {props.transitions.revision}</small>
    </div>
    <Fields>
      <Field label="Dropped intents">{props.transitions.dropped}</Field>
      <Field label="Checkpoints">
        <Show
          when={props.transitions.checkpoints.length > 0}
          fallback={<span class="muted">none reported in this boot</span>}
        >
          <ul class="list">
            <For each={props.transitions.checkpoints}>
              {(checkpoint) => (
                <li>
                  <code>{boundText(checkpoint)}</code>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Field>
    </Fields>
    <Show
      when={props.transitions.latest}
      fallback={<p class="muted">No intent recorded.</p>}
    >
      {(latest) => (
        <Fields>
          <Field label="Latest intent">
            <code>{boundText(latest().intent.command)}</code> on{" "}
            <code>{boundText(latest().intent.route)}</code> (
            {latest().intent.subject}, operation {latest().intent.operation.id})
          </Field>
          <Field label="Outcome">
            {latest().outcome}
            {latest().judgedHere ? ", judged by this boot" : ""}
          </Field>
          <Field label="Attempts">
            {latest().attempts}
            {latest().exhausted ? ", budget spent" : ", within budget"}
          </Field>
          <Field label="Was running">
            {formatOptionalIdentity(latest().intent.current, "not known")}
          </Field>
          <Field label="Aimed at">
            {formatOptionalIdentity(latest().intent.target, "no target")}
          </Field>
          <Field label="Binding">{latest().intent.binding}</Field>
          <Field label="Written">
            {formatDateTime(latest().intent.createdAt)}
          </Field>
          <Field label="Kept until">
            {formatDateTime(latest().intent.expiresAt)}
          </Field>
        </Fields>
      )}
    </Show>
  </Section>
);

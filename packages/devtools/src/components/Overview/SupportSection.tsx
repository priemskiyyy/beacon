import type { SupportState } from "@priemskiyyy/beacon";
import { For, Show } from "solid-js";

import { EvidenceFields } from "src/components/Routes/EvidenceFields";
import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { StateBadge } from "src/components/shared/StateBadge";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import { boundText } from "src/utils/boundText";

type SupportSectionProps = { support: SupportState };

/** Whether the running application is acceptable under the application's own policy. A failing check never turns supported into unsupported. */
export const SupportSection = (props: SupportSectionProps) => (
  <Section title="Support">
    <div class="fact-head">
      <StateBadge state={props.support.status}>
        {props.support.status}
      </StateBadge>
      <small class="muted">snapshot {props.support.revision}</small>
    </div>
    <Fields>
      <Field label="Reason">{formatOptionalText(props.support.reason)}</Field>
      <Field label="Error">
        {props.support.error === null
          ? "none"
          : `${props.support.error.code}: ${boundText(props.support.error.message)}`}
      </Field>
    </Fields>
    <Show
      when={props.support.evaluation}
      fallback={<p class="muted">No evaluation yet.</p>}
    >
      {(evaluation) => (
        <>
          <Fields>
            <Field label="Evaluated status">{evaluation().status}</Field>
            <Field label="Under running revision">
              {evaluation().evaluatedRunningRevision}
            </Field>
            <Field label="Reasons">
              <Show
                when={evaluation().reasons.length > 0}
                fallback={<span class="muted">none</span>}
              >
                <ul class="list">
                  <For each={evaluation().reasons}>
                    {(reason) => (
                      <li>
                        <code>{boundText(reason.code)}</code>
                        <small>
                          {reason.subject === null
                            ? "no subject"
                            : reason.subject}
                        </small>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Field>
            <Field label="Remediation">
              <Show
                when={evaluation().remediation.length > 0}
                fallback={<span class="muted">none</span>}
              >
                <ul class="list">
                  <For each={evaluation().remediation}>
                    {(remediation) => (
                      <li>
                        <code>{boundText(remediation.route)}</code>
                        <small>
                          {remediation.level} ·{" "}
                          {remediation.usable ? "usable now" : "not usable now"}
                        </small>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </Field>
          </Fields>
          <EvidenceFields evidence={evaluation().evidence} />
        </>
      )}
    </Show>
  </Section>
);

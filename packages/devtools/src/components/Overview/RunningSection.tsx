import type { RunningApplication } from "@priemskiyyy/beacon";
import { For } from "solid-js";

import { RunningFactRow } from "src/components/Overview/RunningFactRow";
import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { boundText } from "src/utils/boundText";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";

type RunningSectionProps = {
  running: RunningApplication;
  showRaw: boolean;
};

/** What executes right now per subject, as far as the local readers said. A subject that is not known is never an old version. */
export const RunningSection = (props: RunningSectionProps) => (
  <Section title="Running">
    <Fields>
      <Field label="Boot">{boundText(props.running.boot.id)}</Field>
      <Field label="Revision">{props.running.revision}</Field>
    </Fields>
    <ul class="list">
      <For each={RUNNING_SUBJECTS}>
        {(subject) => (
          <RunningFactRow
            subject={subject}
            fact={props.running[subject]}
            showRaw={props.showRaw}
          />
        )}
      </For>
    </ul>
  </Section>
);

import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { formatDateTime } from "src/formatting/formatDateTime";
import { formatIdentity } from "src/formatting/formatIdentity";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import type { ObservedRouteSnapshot } from "src/types/internal/ObservedRouteSnapshot";
import { assertUnreachable } from "src/utils/assertUnreachable";

type PreparedSectionProps = {
  prepared: ObservedRouteSnapshot["prepared"];
};

/** What the provider reports ready for a later step. It says nothing about what runs. */
export const PreparedSection = (props: PreparedSectionProps) => (
  <Section title="Prepared">
    {(() => {
      const { prepared } = props;

      if (prepared.status === "not-applicable") {
        return (
          <p class="muted">Not applicable: this route prepares nothing.</p>
        );
      }

      if (prepared.status === "unknown") {
        return (
          <Fields>
            <Field label="Status">unknown</Field>
          </Fields>
        );
      }

      if (prepared.status === "none") {
        return (
          <Fields>
            <Field label="Status">none</Field>
            <Field label="Observed">
              {formatDateTime(prepared.observedAt)}
            </Field>
          </Fields>
        );
      }

      if (prepared.status === "ready") {
        return (
          <Fields>
            <Field label="Status">ready</Field>
            <Field label="Identity">
              {formatIdentity(prepared.value.release.identity)}
            </Field>
            <Field label="Label">
              {formatOptionalText(prepared.value.release.label)}
            </Field>
            <Field label="Observed">
              {formatDateTime(prepared.observedAt)}
            </Field>
          </Fields>
        );
      }

      return assertUnreachable(prepared);
    })()}
  </Section>
);

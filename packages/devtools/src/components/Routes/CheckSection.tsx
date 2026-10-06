import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { formatDateTime } from "src/formatting/formatDateTime";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import type { ObservedRouteSnapshot } from "src/types/internal/ObservedRouteSnapshot";
import { assertUnreachable } from "src/utils/assertUnreachable";

type CheckSectionProps = {
  check: ObservedRouteSnapshot["check"];
};

/** The latest check attempt. A failure never rewrites the observation beside it. */
export const CheckSection = (props: CheckSectionProps) => (
  <Section title="Last check">
    {(() => {
      const { check } = props;

      if (check.state === "idle") {
        return (
          <Fields>
            <Field label="State">idle</Field>
          </Fields>
        );
      }

      if (check.state === "checking") {
        return (
          <Fields>
            <Field label="State">checking</Field>
            <Field label="Attempt">{check.attempt}</Field>
            <Field label="Started">{formatDateTime(check.startedAt)}</Field>
          </Fields>
        );
      }

      if (check.state === "succeeded") {
        return (
          <Fields>
            <Field label="State">succeeded</Field>
            <Field label="Attempt">{check.attempt}</Field>
            <Field label="Started">{formatDateTime(check.startedAt)}</Field>
            <Field label="Settled">{formatDateTime(check.settledAt)}</Field>
          </Fields>
        );
      }

      if (check.state === "failed") {
        return (
          <Fields>
            <Field label="State">failed</Field>
            <Field label="Attempt">{check.attempt}</Field>
            <Field label="Started">{formatDateTime(check.startedAt)}</Field>
            <Field label="Settled">{formatDateTime(check.settledAt)}</Field>
            <Field label="Error">{check.error.code}</Field>
            <Field label="Message">
              {formatOptionalText(check.error.message)}
            </Field>
          </Fields>
        );
      }

      return assertUnreachable(check);
    })()}
  </Section>
);

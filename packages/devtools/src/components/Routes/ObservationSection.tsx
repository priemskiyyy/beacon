import { EvidenceFields } from "src/components/Routes/EvidenceFields";
import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import { formatRelease } from "src/formatting/formatRelease";
import type { ObservedRouteSnapshot } from "src/types/internal/ObservedRouteSnapshot";
import { assertUnreachable } from "src/utils/assertUnreachable";

type ObservationSectionProps = {
  observation: ObservedRouteSnapshot["observation"];
};

/** What the route accepted about its authority, and the evidence behind it. */
export const ObservationSection = (props: ObservationSectionProps) => (
  <Section title="Observation">
    {(() => {
      const observation = props.observation;

      if (observation.status === "unknown") {
        return (
          <Fields>
            <Field label="Status">unknown</Field>
            <Field label="Reason">{observation.reason}</Field>
          </Fields>
        );
      }

      if (observation.status === "available") {
        return (
          <>
            <Fields>
              <Field label="Status">available</Field>
            </Fields>
            <EvidenceFields evidence={observation.evidence} />
          </>
        );
      }

      if (observation.status === "none") {
        return (
          <>
            <Fields>
              <Field label="Status">none</Field>
              <Field label="Reason">{observation.reason}</Field>
              <Field label="Detail">
                {formatOptionalText(observation.detail)}
              </Field>
              <Field label="Candidate">
                {formatRelease(observation.candidate)}
              </Field>
            </Fields>
            <EvidenceFields evidence={observation.evidence} />
          </>
        );
      }

      if (observation.status === "inconclusive") {
        return (
          <>
            <Fields>
              <Field label="Status">inconclusive</Field>
              <Field label="Reason">{observation.reason}</Field>
              <Field label="Candidate">
                {formatRelease(observation.candidate)}
              </Field>
            </Fields>
            <EvidenceFields evidence={observation.evidence} />
          </>
        );
      }

      return assertUnreachable(observation);
    })()}
  </Section>
);

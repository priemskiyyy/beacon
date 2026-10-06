import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { Section } from "src/components/shared/Section";
import { formatIdentity } from "src/formatting/formatIdentity";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import type { ObservedRouteSnapshot } from "src/types/internal/ObservedRouteSnapshot";

type OfferSectionProps = {
  observation: ObservedRouteSnapshot["observation"];
};

/** The release the authority wants this route to offer, when it offers one. */
export const OfferSection = (props: OfferSectionProps) => (
  <Section title="Offer">
    {(() => {
      const { observation } = props;

      if (observation.status !== "available") {
        return <p class="muted">No offer.</p>;
      }

      return (
        <Fields>
          <Field label="Identity">
            {formatIdentity(observation.offer.release.identity)}
          </Field>
          <Field label="Label">
            {formatOptionalText(observation.offer.release.label)}
          </Field>
        </Fields>
      );
    })()}
  </Section>
);

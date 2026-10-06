import type { Evidence } from "@priemskiyyy/beacon";

import { Field } from "src/components/shared/Field";
import { Fields } from "src/components/shared/Fields";
import { formatDateTime } from "src/formatting/formatDateTime";
import { formatExpiry } from "src/formatting/formatExpiry";
import { formatOptionalText } from "src/formatting/formatOptionalText";
import { formatRevision } from "src/formatting/formatRevision";
import { boundText } from "src/utils/boundText";

type EvidenceFieldsProps = { evidence: Evidence };

/** What backs an accepted answer: who said it, how it arrived, when, until when, and under which revision. */
export const EvidenceFields = (props: EvidenceFieldsProps) => (
  <Fields>
    <Field label="Source">{boundText(props.evidence.source)}</Field>
    <Field label="Origin">{props.evidence.origin}</Field>
    <Field label="Freshness">
      <span data-freshness={props.evidence.freshness}>
        {props.evidence.freshness}
      </span>
    </Field>
    <Field label="Received">{formatDateTime(props.evidence.receivedAt)}</Field>
    <Field label="Expires">{formatExpiry(props.evidence.expiresAt)}</Field>
    <Field label="Issuer">{formatOptionalText(props.evidence.issuer)}</Field>
    <Field label="Revision">{formatRevision(props.evidence.revision)}</Field>
  </Fields>
);

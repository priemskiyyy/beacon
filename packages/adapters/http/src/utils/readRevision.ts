import type { DecisionRevision } from "@priemskiyyy/beacon";

import type { VariantReader } from "src/types/internal/VariantReader";
import { readField } from "src/utils/readField";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

const READERS: Record<
  DecisionRevision["kind"],
  VariantReader<DecisionRevision>
> = {
  opaque: (record, field) => ({
    kind: "opaque",
    value: readText(readField(record, "value"), `${field}.value`),
  }),
  ordered: (record, field) => ({
    kind: "ordered",
    domain: readText(readField(record, "domain"), `${field}.domain`),
    epoch: readText(readField(record, "epoch"), `${field}.epoch`),
    value: readText(readField(record, "value"), `${field}.value`),
  }),
};

/** How the authority numbers its decision: opaque, or ordered by a text. The core requires an ordered value to be a canonical decimal when it accepts the read, so that no number size rounds it. */
export const readRevision = (value: unknown, field: string): DecisionRevision =>
  readVariant({ value, field, tag: "kind", readers: READERS });

import type { DecisionRevision } from "@priemskiyyy/beacon";

import type { FieldReader } from "src/types/internal/FieldReader";
import { readField } from "src/utils/readField";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

const READERS: Record<
  DecisionRevision["kind"],
  FieldReader<DecisionRevision>
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

/** How the authority numbers its decision: opaque, or ordered by a decimal text that no number size rounds. */
export const readRevision = (value: unknown, field: string): DecisionRevision =>
  readVariant({ value, field, tag: "kind", readers: READERS });

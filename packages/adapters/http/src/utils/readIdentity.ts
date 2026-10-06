import type { ReleaseIdentity } from "@priemskiyyy/beacon";

import type { FieldReader } from "src/types/internal/FieldReader";
import { readField } from "src/utils/readField";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

const READERS: Record<
  ReleaseIdentity["status"],
  FieldReader<ReleaseIdentity>
> = {
  known: (record, field) => ({
    status: "known",
    authority: readText(readField(record, "authority"), `${field}.authority`),
    domain: readText(readField(record, "domain"), `${field}.domain`),
    value: readText(readField(record, "value"), `${field}.value`),
  }),
  unknown: (record, field) => ({
    status: "unknown",
    reason: readText(readField(record, "reason"), `${field}.reason`),
  }),
};

/** The identity of a release: known within an authority and a domain, or explicitly unknown. */
export const readIdentity = (value: unknown, field: string): ReleaseIdentity =>
  readVariant({ value, field, tag: "status", readers: READERS });

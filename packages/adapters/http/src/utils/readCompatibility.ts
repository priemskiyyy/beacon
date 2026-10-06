import type { Compatibility } from "@priemskiyyy/beacon";

import type { FieldReader } from "src/types/internal/FieldReader";
import { readField } from "src/utils/readField";
import { readList } from "src/utils/readList";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

const READERS: Record<Compatibility["status"], FieldReader<Compatibility>> = {
  compatible: (record, field) => ({
    status: "compatible",
    basis: readText(readField(record, "basis"), `${field}.basis`),
  }),
  incompatible: (record, field) => ({
    status: "incompatible",
    reasons: readList(
      readField(record, "reasons"),
      `${field}.reasons`,
      readText,
    ),
  }),
  delegated: (record, field) => ({
    status: "delegated",
    authority: readText(readField(record, "authority"), `${field}.authority`),
  }),
  unknown: (record, field) => ({
    status: "unknown",
    reason: readText(readField(record, "reason"), `${field}.reason`),
  }),
  "not-applicable": () => ({ status: "not-applicable" }),
};

/** What a release is compatible with, as its authority states it. */
export const readCompatibility = (
  value: unknown,
  field: string,
): Compatibility =>
  readVariant({ value, field, tag: "status", readers: READERS });

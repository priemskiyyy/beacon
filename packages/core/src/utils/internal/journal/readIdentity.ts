import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import { readField } from "src/utils/internal/journal/readField";

/** A release identity as it was persisted, or `undefined` when what was read is not one: the record is a trust boundary. */
export const readIdentity = (value: unknown): ReleaseIdentity | undefined => {
  const status = readField(value, "status");

  if (status === "unknown") {
    const reason = readField(value, "reason");

    if (typeof reason !== "string") {
      return undefined;
    }

    return { status: "unknown", reason };
  }

  const authority = readField(value, "authority");
  const domain = readField(value, "domain");
  const identified = readField(value, "value");

  if (
    status !== "known" ||
    typeof authority !== "string" ||
    typeof domain !== "string" ||
    typeof identified !== "string"
  ) {
    return undefined;
  }

  return { status: "known", authority, domain, value: identified };
};

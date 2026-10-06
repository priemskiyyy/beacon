import type { ReleaseIdentity } from "src/types/ReleaseIdentity";

/** A release identity as it was persisted, or `undefined` when what was read is not one: the record is a trust boundary. */
export const readIdentity = (value: unknown): ReleaseIdentity | undefined => {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }

  if (!("status" in value)) {
    return undefined;
  }

  if (value.status === "unknown") {
    if (!("reason" in value) || typeof value.reason !== "string") {
      return undefined;
    }

    return { status: "unknown", reason: value.reason };
  }

  if (value.status !== "known") {
    return undefined;
  }

  if (
    !("authority" in value) ||
    !("domain" in value) ||
    !("value" in value) ||
    typeof value.authority !== "string" ||
    typeof value.domain !== "string" ||
    typeof value.value !== "string"
  ) {
    return undefined;
  }

  return {
    status: "known",
    authority: value.authority,
    domain: value.domain,
    value: value.value,
  };
};

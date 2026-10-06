import type { ManifestLimits } from "src/types/ManifestLimits";
import type { JsonRecord } from "src/types/internal/JsonRecord";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readTimestamp } from "src/utils/readTimestamp";

type ReadExpiryOptions = {
  record: JsonRecord;
  now: number;
  limits: ManifestLimits;
};

/**
 * The instant a manifest stops holding: the narrowest of what the authority
 * says and what the local limits allow. A manifest that expires before it is
 * issued, lives longer than the limit, is issued ahead of the local clock by
 * more than the skew, or has already expired is refused, so a stale copy is
 * never fresher than the authority said.
 */
export const readExpiry = ({
  record,
  now,
  limits,
}: ReadExpiryOptions): number => {
  const issuedAt = readTimestamp(readField(record, "issuedAt"), "issuedAt");
  const expiresAt = readTimestamp(readField(record, "expiresAt"), "expiresAt");

  if (expiresAt < issuedAt) {
    throw invalidManifest("expiresAt must not be before issuedAt.");
  }

  if (expiresAt - issuedAt > limits.lifetime) {
    throw invalidManifest(
      `The manifest must not live longer than ${limits.lifetime} milliseconds.`,
    );
  }

  if (issuedAt - now > limits.skew) {
    throw invalidManifest(
      `The manifest is issued more than ${limits.skew} milliseconds ahead of the local clock.`,
    );
  }

  if (expiresAt <= now) {
    throw invalidManifest("The manifest has already expired.");
  }

  return Math.min(expiresAt, now + limits.lifetime);
};

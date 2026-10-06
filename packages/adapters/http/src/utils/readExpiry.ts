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

// A time the manifest does not have is `null`; one it has is read whole, so a `null` in the JSON is not an absent time.
const readOptionalTimestamp = (record: JsonRecord, field: string) => {
  const value = readField(record, field);

  if (value === undefined) {
    return null;
  }

  return readTimestamp(value, field);
};

/**
 * The instant a manifest stops holding: the narrowest of what the authority
 * says and what the local limits allow. A manifest that expires before it is
 * issued, lives longer than the limit, is issued ahead of the local clock by
 * more than the skew, or has already expired is refused, so a stale copy is
 * never fresher than the authority said. Both times are optional, as a static
 * host cannot write them: without an `expiresAt` the authority claimed no
 * expiry, and the evidence holds for the client's own window, `now` plus the
 * lifetime limit, and `holdsFor` says so, so that the confirmation of a later
 * read renews it; without an `issuedAt` there is nothing to order the expiry
 * or the clock against.
 */
export const readExpiry = ({
  record,
  now,
  limits,
}: ReadExpiryOptions): { expiresAt: number; holdsFor?: number } => {
  const issuedAt = readOptionalTimestamp(record, "issuedAt");
  const expiresAt = readOptionalTimestamp(record, "expiresAt");

  if (issuedAt !== null && expiresAt !== null) {
    if (expiresAt < issuedAt) {
      throw invalidManifest("expiresAt must not be before issuedAt.");
    }

    if (expiresAt - issuedAt > limits.lifetime) {
      throw invalidManifest(
        `The manifest must not live longer than ${limits.lifetime} milliseconds.`,
      );
    }
  }

  if (issuedAt !== null && issuedAt - now > limits.skew) {
    throw invalidManifest(
      `The manifest is issued more than ${limits.skew} milliseconds ahead of the local clock.`,
    );
  }

  if (expiresAt === null) {
    return { expiresAt: now + limits.lifetime, holdsFor: limits.lifetime };
  }

  if (expiresAt <= now) {
    throw invalidManifest("The manifest has already expired.");
  }

  return { expiresAt: Math.min(expiresAt, now + limits.lifetime) };
};

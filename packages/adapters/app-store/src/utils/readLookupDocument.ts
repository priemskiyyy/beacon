import { parseUtcTimestamp } from "@priemskiyyy/beacon/adapter";

import type { AppStoreDocument } from "src/types/AppStoreDocument";
import type { AppStoreLookupResponse } from "src/types/AppStoreLookupResponse";
import { MARKETING_VERSION_DOMAIN } from "src/utils/constants/lookup";
import { NO_MATCH } from "src/utils/constants/reasons";
import { invalidLookup } from "src/utils/invalidLookup";

type Expected = { appId: string; bundleId: string | undefined };

/**
 * The decision one lookup stands for. No entry means nothing matched in that
 * lookup context, which is not proof that no update exists. Several entries,
 * another app or bundle, a missing version and a malformed date are refused
 * as an invalid document, each with its own message, and never repaired into
 * an answer.
 */
export const readLookupDocument = (
  { results }: AppStoreLookupResponse,
  { appId, bundleId }: Expected,
): AppStoreDocument => {
  const [entry, ...others] = results;

  if (entry === undefined) {
    return { decision: { kind: "none", reason: NO_MATCH } };
  }

  if (others.length > 0) {
    throw invalidLookup(
      "The App Store lookup answered several entries for one app.",
    );
  }

  if (String(entry.trackId) !== appId) {
    throw invalidLookup(
      "The App Store lookup answered an entry for another app id.",
    );
  }

  if (bundleId !== undefined && entry.bundleId !== bundleId) {
    throw invalidLookup(
      "The App Store lookup answered an entry for another bundle id.",
    );
  }

  if (entry.version === "") {
    throw invalidLookup(
      "The App Store lookup answered an entry with no version.",
    );
  }

  const releasedAt = parseUtcTimestamp(entry.currentVersionReleaseDate);

  if (releasedAt === undefined) {
    throw invalidLookup(
      "The App Store lookup answered an entry with a malformed release date.",
    );
  }

  return {
    decision: {
      kind: "candidate",
      release: {
        identity: {
          status: "known",
          authority: appId,
          domain: MARKETING_VERSION_DOMAIN,
          value: entry.version,
        },
        label: entry.version,
        metadata: { releasedAt },
        order: entry.version,
      },
    },
  };
};

import { BeaconError } from "@priemskiyyy/beacon";

import type { AppStoreDocument } from "src/types/AppStoreDocument";
import type { AppStoreLookupResponse } from "src/types/AppStoreLookupResponse";
import { MARKETING_VERSION_DOMAIN } from "src/utils/constants/lookup";
import {
  AMBIGUOUS_LOOKUP,
  APP_ID_MISMATCH,
  BUNDLE_ID_MISMATCH,
  MALFORMED_RELEASE_DATE,
  MISSING_VERSION,
} from "src/utils/constants/messages";
import { readReleaseDate } from "src/utils/readReleaseDate";

type Expected = { appId: string; bundleId: string | undefined };

const refuse = (message: string) =>
  new BeaconError({ code: "SOURCE_FAILED", message });

/**
 * The decision one lookup stands for. No entry means nothing matched in that
 * lookup context, which is not proof that no update exists. Several entries,
 * another app or bundle, a missing version and a malformed date are refused,
 * each with its own message, and never repaired into an answer.
 */
export const readLookupDocument = (
  { results }: AppStoreLookupResponse,
  { appId, bundleId }: Expected,
): AppStoreDocument => {
  const [entry, ...others] = results;

  if (entry === undefined) {
    return { decision: { kind: "none", reason: "no-match" } };
  }

  if (others.length > 0) {
    throw refuse(AMBIGUOUS_LOOKUP);
  }

  if (String(entry.trackId) !== appId) {
    throw refuse(APP_ID_MISMATCH);
  }

  if (bundleId !== undefined && entry.bundleId !== bundleId) {
    throw refuse(BUNDLE_ID_MISMATCH);
  }

  if (entry.version === "") {
    throw refuse(MISSING_VERSION);
  }

  const releasedAt = readReleaseDate(entry.currentVersionReleaseDate);

  if (releasedAt === undefined) {
    throw refuse(MALFORMED_RELEASE_DATE);
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

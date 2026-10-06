import { ANDROID_VERSION_CODE_DOMAIN } from "@priemskiyyy/beacon/adapter";
import type { PreparedDraft } from "@priemskiyyy/beacon/adapter";

import type { PlayReading } from "src/types/internal/PlayReading";
import type { PlayInstallStatus } from "src/types/PlayInstallStatus";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayPrepared } from "src/types/PlayPrepared";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import { IN_PROGRESS_IDENTITY } from "src/utils/constants/identities";

const readFlows = (info: { flexible: boolean; immediate: boolean }) => {
  const flows: PlayOffer["flows"] = [];

  if (info.flexible) {
    flows.push("flexible");
  }

  if (info.immediate) {
    flows.push("immediate");
  }

  return flows;
};

// A version code is a positive whole number. Anything else is a bridge that garbled its answer, and naming a build "NaN" or "undefined" would be a made-up identity.
const isVersionCode = (value: number) =>
  Number.isSafeInteger(value) && value > 0;

// A query that finds the download done says the update is prepared, and one that does not says nothing: Play cannot say that nothing is prepared.
const readPrepared = (
  release: PlayPrepared["release"],
  installStatus: PlayInstallStatus,
): PreparedDraft<PlayPrepared> | null => {
  if (installStatus !== "downloaded") {
    return null;
  }

  return { status: "ready", value: { release } };
};

/**
 * What a query of Play means, in its four categories. A version, its priority
 * and its staleness are read only where Play defines them; anything Play does
 * not say becomes unknown, never a synthetic version, and so does a category
 * a native module invents or a version code that is no positive integer. The
 * unknown observation carries no reason of its own: a driver's `unknown` can
 * only say that the provider cannot run here. Not available is no offer here,
 * not proof that no release exists.
 */
export const readUpdateInfo = (
  info: PlayUpdateInfo,
  application: string,
): PlayReading => {
  if (info.availability === "not-available") {
    return {
      observation: {
        status: "none",
        reason: "no-decision",
        detail: "not-available",
      },
      prepared: null,
    };
  }

  if (info.availability === "in-progress") {
    const release: PlayOffer["release"] = { identity: IN_PROGRESS_IDENTITY };

    return {
      observation: {
        status: "available",
        offer: {
          release,
          flows: ["immediate"],
          // The bridge says nothing of a continuation's priority, so this is Play's default and not a reading.
          priority: 0,
          stalenessDays: null,
          inProgress: true,
        },
      },
      prepared: readPrepared(release, info.installStatus),
    };
  }

  if (info.availability === "available" && isVersionCode(info.versionCode)) {
    // A published build is named by the version code Play orders builds with, under the application that publishes it.
    const release: PlayOffer["release"] = {
      identity: {
        status: "known",
        authority: application,
        domain: ANDROID_VERSION_CODE_DOMAIN,
        value: String(info.versionCode),
      },
    };

    return {
      observation: {
        status: "available",
        offer: {
          release,
          flows: readFlows(info),
          priority: info.priority,
          stalenessDays: info.stalenessDays,
          inProgress: false,
        },
      },
      prepared: readPrepared(release, info.installStatus),
    };
  }

  return {
    observation: { status: "unknown", reason: "unsupported-environment" },
    prepared: null,
  };
};

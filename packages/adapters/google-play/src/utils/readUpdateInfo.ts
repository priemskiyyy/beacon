import type { PlayReading } from "src/types/internal/PlayReading";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import { VERSION_CODE_DOMAIN } from "src/utils/constants/authority";
import { IN_PROGRESS_IDENTITY } from "src/utils/constants/reasons";

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

// An answer that names no release and says nothing of an install.
const readNoRelease = (
  observation: PlayReading["observation"],
): PlayReading => ({
  observation,
  release: null,
  installStatus: null,
});

/**
 * What a query of Play means, in its four categories. A version, its priority
 * and its staleness are read only where Play defines them; anything Play does
 * not say becomes unknown, never a synthetic version, and so does a category
 * a native module invents. Not available is no offer here, not proof that no
 * release exists.
 */
export const readUpdateInfo = (
  info: PlayUpdateInfo,
  application: string,
): PlayReading => {
  if (info.availability === "not-available") {
    return readNoRelease({
      status: "none",
      reason: "no-decision",
      detail: "not-available",
    });
  }

  if (info.availability === "in-progress") {
    const release = {
      identity: { status: "unknown", reason: IN_PROGRESS_IDENTITY },
    } satisfies PlayOffer["release"];

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
      release,
      installStatus: info.installStatus,
    };
  }

  if (info.availability === "available") {
    // A published build is named by the version code Play orders builds with, under the application that publishes it.
    const release = {
      identity: {
        status: "known",
        authority: application,
        domain: VERSION_CODE_DOMAIN,
        value: String(info.versionCode),
      },
    } satisfies PlayOffer["release"];

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
      release,
      installStatus: info.installStatus,
    };
  }

  return readNoRelease({
    status: "unknown",
    reason: "unsupported-environment",
  });
};

import type { PlayReading } from "src/types/internal/PlayReading";
import type { PlayOffer } from "src/types/PlayOffer";
import type { PlayUpdateInfo } from "src/types/PlayUpdateInfo";
import { IN_PROGRESS_IDENTITY } from "src/utils/constants/reasons";
import { createVersionIdentity } from "src/utils/createVersionIdentity";

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

/**
 * What a query of Play means, in its four categories. A version, its priority
 * and its staleness are read only where Play defines them; anything Play does
 * not say becomes unknown, never a synthetic version. Not available is no
 * offer here, not proof that no release exists.
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
      release: null,
      installStatus: null,
    };
  }

  if (info.availability === "unknown") {
    return {
      observation: { status: "unknown", reason: "unsupported-environment" },
      release: null,
      installStatus: null,
    };
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
          priority: 0,
          stalenessDays: null,
          inProgress: true,
        },
      },
      release,
      installStatus: info.installStatus,
    };
  }

  const release = {
    identity: createVersionIdentity(application, info.versionCode),
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
};

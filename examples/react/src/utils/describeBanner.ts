import type {
  RegisteredRouteState,
} from "@priemskiyyy/beacon-react";
import type { SupportState } from "@priemskiyyy/beacon";
import { match } from "ts-pattern";

import { NO_OFFER_LABELS } from "example-shared/lab/constants/labels";
import type { Tone } from "example-shared/ui/types/Tone";

type BannerView = { tone: Tone; headline: string; detail: string };

type BannerInput = {
  observation: RegisteredRouteState<"web">["observation"];
  support: SupportState;
};

const isUsable = ({ evaluation }: SupportState) =>
  evaluation?.remediation.some(({ usable }) => usable) ?? false;

/**
 * What the banner says. A build the policy no longer supports is the first
 * thing to say, whatever the route observed, and an unsupported build with no
 * usable route is shown as it is: it is not answered with a redirect.
 */
export const describeBanner = ({
  observation,
  support,
}: BannerInput): BannerView => {
  if (support.status === "unsupported" && isUsable(support)) {
    return {
      tone: "danger",
      headline: "This build is no longer supported",
      detail: "The application requires an update to continue.",
    };
  }

  if (support.status === "unsupported") {
    return {
      tone: "danger",
      headline: "This build is no longer supported",
      detail:
        "No update is usable yet. Check again once a fix is published; nothing here redirects.",
    };
  }

  return match(observation)
    .with({ status: "available" }, ({ offer }) => ({
      tone: "accent" as const,
      headline: `${offer.release.label ?? "A newer build"} is available`,
      detail:
        "Update asks the browser to reload. The next document runs whatever is deployed then, which may not be this build.",
    }))
    .with({ status: "none" }, ({ reason }) => ({
      tone: "positive" as const,
      headline: "You are up to date",
      detail: `Nothing on offer: ${NO_OFFER_LABELS[reason]}.`,
    }))
    .with({ status: "unknown" }, () => ({
      tone: "warning" as const,
      headline: "Not checked yet",
      detail: "No authority has answered, so Beacon says nothing about updates.",
    }))
    .with({ status: "inconclusive" }, () => ({
      tone: "warning" as const,
      headline: "Cannot tell whether an update exists",
      detail: "The evidence cannot say, which is never read as up to date.",
    }))
    .exhaustive();
};

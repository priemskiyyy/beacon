import type { Observation, RouteBody, SupportState } from "@priemskiyyy/beacon";
import { match } from "ts-pattern";

import { NO_OFFER_LABELS } from "example-shared/lab/constants/labels";
import type { BannerView } from "example-shared/lab/types/BannerView";

type BannerInput = {
  observation: Observation<string, RouteBody>;
  support: SupportState;
};

const isUsable = ({ evaluation }: SupportState) =>
  evaluation?.remediation.some(({ usable }) => usable) ?? false;

// A policy that lapsed is unknown with its last verdict kept beside it. Keeping a gate that verdict closed is the application's choice, and it is the safe one.
const readVerdict = ({ status, evaluation }: SupportState) => {
  if (status !== "unknown" || evaluation === null) {
    return status;
  }

  return evaluation.status;
};

/**
 * What the banner says. A build the policy no longer supports is the first
 * thing to say, whatever the route observed, and an unsupported build with no
 * usable route is shown as it is: it is not answered with a redirect.
 */
export const describeBanner = ({
  observation,
  support,
}: BannerInput): BannerView => {
  if (readVerdict(support) === "unsupported" && isUsable(support)) {
    return {
      tone: "danger",
      headline: "This build is no longer supported",
      detail: "The application requires an update to continue.",
    };
  }

  if (readVerdict(support) === "unsupported") {
    return {
      tone: "danger",
      headline: "This build is no longer supported",
      detail:
        "No update is usable yet. Check again once a fix is published; nothing here redirects.",
    };
  }

  return match(observation)
    .with({ status: "available" }, ({ offer }): BannerView => ({
      tone: "accent",
      headline: `${offer.release.label ?? "A newer build"} is available`,
      detail:
        "Update asks the browser to reload. The next document runs whatever is deployed then, which may not be this build.",
    }))
    .with({ status: "none" }, ({ reason }): BannerView => ({
      tone: "positive",
      headline: "You are up to date",
      detail: `Nothing on offer: ${NO_OFFER_LABELS[reason]}.`,
    }))
    .with({ status: "unknown" }, (): BannerView => ({
      tone: "warning",
      headline: "Not checked yet",
      detail:
        "No authority has answered, so Beacon says nothing about updates.",
    }))
    .with({ status: "inconclusive" }, (): BannerView => ({
      tone: "warning",
      headline: "Cannot tell whether an update exists",
      detail: "The evidence cannot say, which is never read as up to date.",
    }))
    .exhaustive();
};

import type { Observation, RouteBody } from "@priemskiyyy/beacon";
import { match } from "ts-pattern";

import { formatRelease } from "example-shared/formatting/formatRelease";
import {
  INCONCLUSIVE_LABELS,
  NO_OFFER_LABELS,
  UNKNOWN_LABELS,
} from "example-shared/lab/constants/labels";

export const formatObservation = (
  observation: Observation<string, RouteBody>,
) =>
  match(observation)
    .with(
      { status: "unknown" },
      ({ reason }) => `Unknown: ${UNKNOWN_LABELS[reason]}`,
    )
    .with(
      { status: "none" },
      ({ reason }) => `Nothing on offer: ${NO_OFFER_LABELS[reason]}`,
    )
    .with(
      { status: "available" },
      ({ offer }) => `On offer: ${formatRelease(offer.release)}`,
    )
    .with(
      { status: "inconclusive" },
      ({ reason }) => `Cannot tell: ${INCONCLUSIVE_LABELS[reason]}`,
    )
    .exhaustive();

import type { CommandOutcome } from "@priemskiyyy/beacon";
import { match } from "ts-pattern";

import { formatBlockReason } from "example-shared/formatting/formatBlockReason";
import { STALE_LABELS } from "example-shared/lab/constants/labels";

/** How a command settled, in plain words; an accepted one is a request, never an installation. */
export const formatOutcome = (outcome: CommandOutcome<{ kind: string }>) =>
  match(outcome)
    .with(
      { status: "accepted" },
      ({ receipt, operation }) =>
        `Accepted, ${receipt.kind} (operation ${operation.id}). Nothing runs differently until a later boot says so`,
    )
    .with(
      { status: "blocked" },
      ({ reasons }) => `Blocked: ${reasons.map(formatBlockReason).join("; ")}`,
    )
    .with(
      { status: "stale" },
      ({ reason }) => `Stale, ${reason}: ${STALE_LABELS[reason]}`,
    )
    .with(
      { status: "unsupported" },
      ({ reason }) => `Unsupported here: ${reason}`,
    )
    .with({ status: "cancelled" }, ({ stage }) => `Cancelled at ${stage}`)
    .with(
      { status: "failed" },
      ({ error }) => `Failed, ${error.code}: ${error.message}`,
    )
    .with(
      { status: "indeterminate" },
      ({ reason }) =>
        `Indeterminate, ${reason}: it may have taken effect and is not retried blindly`,
    )
    .exhaustive();

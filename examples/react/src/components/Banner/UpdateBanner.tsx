import {
  ArrowsClockwise,
  DownloadSimple,
  Hourglass,
} from "@phosphor-icons/react";
import type { CommandOutcome } from "@priemskiyyy/beacon";
import { useBeacon, useRoute, useSupport } from "@priemskiyyy/beacon-react";
import clsx from "clsx";
import type React from "react";
import { useState } from "react";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatOutcome } from "example-shared/formatting/formatOutcome";
import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { OUTCOME_TONES } from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import { Badge } from "src/components/Badge/Badge";
import { Panel } from "src/components/Panel/Panel";
import { describeBanner } from "example-shared/lab/utils/describeBanner";

type UpdateBannerProps = { lab: ReleaseLab };

const TONE_BORDERS = {
  neutral: "border-zinc-300 dark:border-zinc-700",
  positive: "border-emerald-300 dark:border-emerald-900",
  warning: "border-yellow-300 dark:border-yellow-900",
  danger: "border-red-300 dark:border-red-900",
  accent: "border-rose-300 dark:border-rose-800",
  info: "border-sky-300 dark:border-sky-900",
};

export const UpdateBanner: React.FunctionComponent<UpdateBannerProps> = ({
  lab,
}) => {
  const beacon = useBeacon();
  const { observation, check, operation } = useRoute("web");
  const support = useSupport();

  const [outcome, setOutcome] = useState<CommandOutcome<{
    kind: string;
  }> | null>(null);

  const [updating, setUpdating] = useState(false);
  const { tone, headline, detail } = describeBanner({ observation, support });
  const offered = observation.status === "available";

  const handleUpdatePress = async () => {
    if (observation.status !== "available") {
      return;
    }

    setUpdating(true);
    setOutcome(
      await beacon.route("web").reload({ offer: observation.offer.ref }),
    );
    setUpdating(false);
  };

  const handleCheckPress = () => {
    lab.controls.check("manual");
  };

  const handleContinuePress = () => {
    beacon.route("web").acknowledge();
  };

  return (
    <Panel
      title="Update banner"
      icon={DownloadSimple}
      shows="What an application would put in front of a person: the offer, the forced state of an unsupported build, and the outcome of the request they made."
    >
      <div
        className={clsx(
          "flex flex-col gap-3 rounded-xl border-2 p-4",
          TONE_BORDERS[tone],
        )}
      >
        <div className="flex flex-col gap-1">
          <h4 className="text-lg font-semibold">{headline}</h4>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{detail}</p>
        </div>
        {check.state === "failed" ? (
          <p
            role="alert"
            className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
          >
            Inconclusive: the last check failed ({check.error.code}).{" "}
            {observation.status === "unknown"
              ? "Beacon cannot say whether a newer build exists."
              : `The answer accepted at ${formatClockTime(observation.evidence.receivedAt)} stays, and may be out of date.`}
          </p>
        ) : null}
        {observation.status !== "unknown" &&
        observation.evidence.freshness === "expired" ? (
          <p className="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200">
            This answer expired
            {observation.evidence.expiresAt === null
              ? ""
              : ` at ${formatClockTime(observation.evidence.expiresAt)}`}
            . An update with its offer is refused until the next check.
          </p>
        ) : null}
        {operation.state === "indeterminate" ? (
          <p className="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
            <Hourglass aria-hidden="true" size={16} weight="bold" />
            The reload was requested and the navigation has not happened. The
            route stays unresolved until a new document boots or you continue
            here.
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {offered ? (
            <button
              type="button"
              disabled={updating}
              onClick={handleUpdatePress}
              className={buttonStyles({ variant: "primary" })}
            >
              <DownloadSimple aria-hidden="true" size={16} weight="bold" />
              Update
            </button>
          ) : null}
          <button
            type="button"
            disabled={check.state === "checking"}
            onClick={handleCheckPress}
            className={buttonStyles()}
          >
            <ArrowsClockwise aria-hidden="true" size={16} weight="bold" />
            {check.state === "checking" ? "Checking" : "Check again"}
          </button>
          {operation.state === "indeterminate" ? (
            <button
              type="button"
              onClick={handleContinuePress}
              className={buttonStyles({ variant: "ghost" })}
            >
              Continue in this build
            </button>
          ) : null}
        </div>
      </div>
      <div
        role="status"
        aria-label="Update outcome"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        {outcome === null ? (
          <span className="text-zinc-500">No update requested yet.</span>
        ) : (
          <>
            <Badge tone={OUTCOME_TONES[outcome.status]}>{outcome.status}</Badge>
            <span>{formatOutcome(outcome)}</span>
          </>
        )}
      </div>
    </Panel>
  );
};

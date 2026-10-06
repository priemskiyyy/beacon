import type { CommandOutcome } from "@priemskiyyy/beacon";
import { useBeacon, useRoute, useSupport } from "@priemskiyyy/beacon-solid";
import clsx from "clsx";
import { createMemo, createSignal, Show } from "solid-js";
import type { Component } from "solid-js";

import { formatClockTime } from "example-shared/formatting/formatClockTime";
import { formatOutcome } from "example-shared/formatting/formatOutcome";
import { describeBanner } from "example-shared/lab/utils/describeBanner";
import { OUTCOME_TONES } from "example-shared/ui/constants/tones";
import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
import type { Tone } from "example-shared/ui/types/Tone";
import { Badge } from "src/components/Badge/Badge";
import { Icon } from "src/components/Icon/Icon";
import { Panel } from "src/components/Panel/Panel";

const TONE_BORDERS: Record<Tone, string> = {
  neutral: "border-zinc-300 dark:border-zinc-700",
  positive: "border-emerald-300 dark:border-emerald-900",
  warning: "border-yellow-300 dark:border-yellow-900",
  danger: "border-red-300 dark:border-red-900",
  accent: "border-rose-300 dark:border-rose-800",
  info: "border-sky-300 dark:border-sky-900",
};

export const UpdateBanner: Component = () => {
  const beacon = useBeacon();
  const check = useRoute("web", (route) => route.check);
  const observation = useRoute("web", (route) => route.observation);
  const operation = useRoute("web", (route) => route.operation);
  const support = useSupport();

  const [outcome, setOutcome] = createSignal<CommandOutcome<{
    kind: string;
  }> | null>(null);

  const [updating, setUpdating] = createSignal(false);

  const view = createMemo(() =>
    describeBanner({ observation: observation(), support: support() }),
  );

  const offer = createMemo(() => {
    const current = observation();

    if (current.status !== "available") {
      return undefined;
    }

    return current.offer;
  });

  const failedCheck = createMemo(() => {
    const current = check();

    if (current.state !== "failed") {
      return undefined;
    }

    return current;
  });

  const expiredEvidence = createMemo(() => {
    const current = observation();

    if (current.status === "unknown") {
      return undefined;
    }

    if (current.evidence.freshness !== "expired") {
      return undefined;
    }

    return current.evidence;
  });

  const describeAnswer = () => {
    const current = observation();

    if (current.status === "unknown") {
      return "Beacon cannot say whether a newer build exists.";
    }

    return `The answer accepted at ${formatClockTime(current.evidence.receivedAt)} stays, and may be out of date.`;
  };

  const describeExpiry = (expiresAt: number | null) => {
    if (expiresAt === null) {
      return "";
    }

    return ` at ${formatClockTime(expiresAt)}`;
  };

  const handleUpdatePress = async () => {
    const current = offer();

    if (current === undefined) {
      return;
    }

    setUpdating(true);
    setOutcome(await beacon().route("web").reload({ offer: current.ref }));
    setUpdating(false);
  };

  const handleCheckPress = () => {
    beacon().check({ reason: "manual" });
  };

  const handleContinuePress = () => {
    beacon().route("web").acknowledge();
  };

  return (
    <Panel
      title="Update banner"
      icon="download"
      shows="What an application would put in front of a person: the offer, the forced state of an unsupported build, and the outcome of the request they made."
    >
      <div
        class={clsx(
          "flex flex-col gap-3 rounded-xl border-2 p-4",
          TONE_BORDERS[view().tone],
        )}
      >
        <div class="flex flex-col gap-1">
          <h4 class="text-lg font-semibold">{view().headline}</h4>
          <p class="text-sm text-zinc-600 dark:text-zinc-400">
            {view().detail}
          </p>
        </div>
        <Show when={failedCheck()}>
          {(failed) => (
            <p
              role="alert"
              class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
            >
              Inconclusive: the last check failed ({failed().error.code}).{" "}
              {describeAnswer()}
            </p>
          )}
        </Show>
        <Show when={expiredEvidence()}>
          {(evidence) => (
            <p class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200">
              This answer expired{describeExpiry(evidence().expiresAt)}. An
              update with its offer is refused until the next check.
            </p>
          )}
        </Show>
        <Show when={operation().state === "indeterminate"}>
          <p class="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-200">
            <Icon name="hourglass" size={16} />
            The reload was requested and the navigation has not happened. The
            route stays unresolved until a new document boots or you continue
            here.
          </p>
        </Show>
        <div class="flex flex-wrap gap-2">
          <Show when={offer() !== undefined}>
            <button
              type="button"
              disabled={updating()}
              onClick={handleUpdatePress}
              class={buttonStyles({ variant: "primary" })}
            >
              <Icon name="download" size={16} />
              Update
            </button>
          </Show>
          <button
            type="button"
            disabled={check().state === "checking"}
            onClick={handleCheckPress}
            class={buttonStyles()}
          >
            <Icon name="refresh" size={16} />
            {check().state === "checking" ? "Checking" : "Check again"}
          </button>
          <Show when={operation().state === "indeterminate"}>
            <button
              type="button"
              onClick={handleContinuePress}
              class={buttonStyles({ variant: "ghost" })}
            >
              Continue in this build
            </button>
          </Show>
        </div>
      </div>
      <div
        role="status"
        aria-label="Update outcome"
        class="flex flex-wrap items-center gap-2 text-sm"
      >
        <Show
          when={outcome()}
          fallback={<span class="text-zinc-500">No update requested yet.</span>}
        >
          {(current) => (
            <>
              <Badge tone={OUTCOME_TONES[current().status]}>
                {current().status}
              </Badge>
              <span>{formatOutcome(current())}</span>
            </>
          )}
        </Show>
      </div>
    </Panel>
  );
};

<script lang="ts">
  import type {
    CommandOutcome,
    Evidence,
    Observation,
    RouteBody,
  } from "@priemskiyyy/beacon";
  import { useBeacon, useRoute, useSupport } from "@priemskiyyy/beacon-svelte";

  import { formatClockTime } from "example-shared/formatting/formatClockTime";
  import { formatOutcome } from "example-shared/formatting/formatOutcome";
  import { describeBanner } from "example-shared/lab/utils/describeBanner";
  import { OUTCOME_TONES } from "example-shared/ui/constants/tones";
  import { buttonStyles } from "example-shared/ui/styles/buttonStyles";
  import type { Tone } from "example-shared/ui/types/Tone";
  import Badge from "src/components/Badge/Badge.svelte";
  import Icon from "src/components/Icon/Icon.svelte";
  import Panel from "src/components/Panel/Panel.svelte";
  import { useLab } from "src/hooks/useLab";

  const TONE_BORDERS: Record<Tone, string> = {
    neutral: "border-zinc-300 dark:border-zinc-700",
    positive: "border-emerald-300 dark:border-emerald-900",
    warning: "border-yellow-300 dark:border-yellow-900",
    danger: "border-red-300 dark:border-red-900",
    accent: "border-rose-300 dark:border-rose-800",
    info: "border-sky-300 dark:border-sky-900",
  };

  const lab = useLab();
  const beacon = useBeacon();
  const observation = useRoute("web", (snapshot) => snapshot.observation);
  const check = useRoute("web", (snapshot) => snapshot.check);
  const operation = useRoute("web", (snapshot) => snapshot.operation);
  const support = useSupport();

  let outcome = $state.raw<CommandOutcome<{ kind: string }> | null>(null);
  let updating = $state(false);

  const banner = $derived(
    describeBanner({
      observation: observation.current,
      support: support.current,
    }),
  );

  const offered = $derived(observation.current.status === "available");

  const describeFailure = (
    code: string,
    accepted: Observation<string, RouteBody>,
  ) => {
    const failed = `Inconclusive: the last check failed (${code}).`;

    if (accepted.status === "unknown") {
      return `${failed} Beacon cannot say whether a newer build exists.`;
    }

    return `${failed} The answer accepted at ${formatClockTime(accepted.evidence.receivedAt)} stays, and may be out of date.`;
  };

  const describeExpiry = ({ expiresAt }: Evidence) => {
    const refused = "An update with its offer is refused until the next check.";

    if (expiresAt === null) {
      return `This answer expired. ${refused}`;
    }

    return `This answer expired at ${formatClockTime(expiresAt)}. ${refused}`;
  };

  const handleUpdatePress = async () => {
    const { current } = observation;

    if (current.status !== "available") {
      return;
    }

    updating = true;
    outcome = await beacon.current
      .route("web")
      .reload({ offer: current.offer.ref });
    updating = false;
  };

  const handleCheckPress = () => {
    lab.controls.check("manual");
  };

  const handleContinuePress = () => {
    beacon.current.route("web").acknowledge();
  };
</script>

<Panel
  title="Update banner"
  icon="download"
  shows="What an application would put in front of a person: the offer, the forced state of an unsupported build, and the outcome of the request they made."
>
  <div
    class={[
      "flex flex-col gap-3 rounded-xl border-2 p-4",
      TONE_BORDERS[banner.tone],
    ]}
  >
    <div class="flex flex-col gap-1">
      <h4 class="text-lg font-semibold">{banner.headline}</h4>
      <p class="text-sm text-zinc-600 dark:text-zinc-400">{banner.detail}</p>
    </div>
    {#if check.current.state === "failed"}
      <p
        role="alert"
        class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
      >
        {describeFailure(check.current.error.code, observation.current)}
      </p>
    {/if}
    {#if observation.current.status !== "unknown" && observation.current.evidence.freshness === "expired"}
      <p
        class="rounded-lg bg-yellow-50 px-3 py-2 text-sm text-yellow-900 dark:bg-yellow-950/60 dark:text-yellow-200"
      >
        {describeExpiry(observation.current.evidence)}
      </p>
    {/if}
    {#if operation.current.state === "indeterminate"}
      <p
        class="flex items-center gap-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:bg-sky-950/60 dark:text-sky-200"
      >
        <Icon name="hourglass" size={16} class="shrink-0" />
        The reload was requested and the navigation has not happened. The route stays
        unresolved until a new document boots or you continue here.
      </p>
    {/if}
    <div class="flex flex-wrap gap-2">
      {#if offered}
        <button
          type="button"
          disabled={updating}
          onclick={handleUpdatePress}
          class={buttonStyles({ variant: "primary" })}
        >
          <Icon name="download" size={16} />
          Update
        </button>
      {/if}
      <button
        type="button"
        disabled={check.current.state === "checking"}
        onclick={handleCheckPress}
        class={buttonStyles()}
      >
        <Icon name="refresh" size={16} />
        {check.current.state === "checking" ? "Checking" : "Check again"}
      </button>
      {#if operation.current.state === "indeterminate"}
        <button
          type="button"
          onclick={handleContinuePress}
          class={buttonStyles({ variant: "ghost" })}
        >
          Continue in this build
        </button>
      {/if}
    </div>
  </div>
  <div
    role="status"
    aria-label="Update outcome"
    class="flex flex-wrap items-center gap-2 text-sm"
  >
    {#if outcome === null}
      <span class="text-zinc-500">No update requested yet.</span>
    {:else}
      <Badge tone={OUTCOME_TONES[outcome.status]}>{outcome.status}</Badge>
      <span>{formatOutcome(outcome)}</span>
    {/if}
  </div>
</Panel>

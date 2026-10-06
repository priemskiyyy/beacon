<script lang="ts">
  import {
    useBeacon,
    useObservable,
    useRunning,
    useSupport,
  } from "@priemskiyyy/beacon-svelte";

  import { formatRunningFact } from "example-shared/formatting/formatRunningFact";
  import { formatSupport } from "example-shared/formatting/formatSupport";
  import {
    RUNNING_TONES,
    SUPPORT_TONES,
  } from "example-shared/ui/constants/tones";
  import Badge from "src/components/Badge/Badge.svelte";
  import Fact from "src/components/Fact/Fact.svelte";
  import Panel from "src/components/Panel/Panel.svelte";

  const beacon = useBeacon();
  const web = useRunning(({ web: fact }) => fact);
  const boot = useRunning(({ boot: identity }) => identity.id);
  const support = useSupport();

  const counters = useObservable(
    beacon.current.diagnostics,
    (view) => view.counters,
  );

  const formatRemediation = ({ evaluation }: typeof support.current) => {
    if (evaluation === null || evaluation.remediation.length === 0) {
      return "none";
    }

    return evaluation.remediation
      .map(
        ({ route, level, usable }) =>
          `${route} ${level}, ${usable ? "usable now" : "nothing usable yet"}`,
      )
      .join("; ");
  };
</script>

<Panel
  title="Application"
  icon="shield"
  shows="What executes, and whether the application's own policy accepts it. Neither is rewritten by an offer or a reload request."
>
  <dl class="grid gap-2 sm:grid-cols-2">
    <Fact
      term="Running"
      hint="Read from the page itself, never from the manifest. Pending means not read yet."
    >
      <span class="flex flex-col items-start gap-1">
        <Badge tone={RUNNING_TONES[web.current.state]}>
          {web.current.state}
        </Badge>
        <span>{formatRunningFact(web.current)}</span>
      </span>
    </Fact>
    <Fact
      term="Boot"
      hint="Minted once per document, not per build: it tells one boot from the next."
    >
      {boot.current}
    </Fact>
    <Fact
      term="Support"
      hint="The application's policy. A failing check never turns supported into unsupported."
    >
      <span class="flex flex-col items-start gap-1">
        <Badge tone={SUPPORT_TONES[support.current.status]}>
          {support.current.status}
        </Badge>
        <span>{formatSupport(support.current)}</span>
      </span>
    </Fact>
    <Fact
      term="Remediation"
      hint="The routes that would satisfy the policy, and whether each is usable now."
    >
      {formatRemediation(support.current)}
    </Fact>
    <Fact
      term="Contained failures"
      hint="What Beacon dropped or contained instead of throwing into the page."
    >
      {counters.current.lateCallbacks} late callbacks, {counters.current
        .listenerErrors} listener errors, {counters.current.cleanupErrors} cleanup
      errors
    </Fact>
  </dl>
</Panel>

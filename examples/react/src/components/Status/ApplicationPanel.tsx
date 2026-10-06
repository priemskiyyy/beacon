import { ShieldCheck } from "@phosphor-icons/react";
import {
  useBeacon,
  useObservable,
  useRunning,
  useSupport,
} from "@priemskiyyy/beacon-react";
import type React from "react";

import { formatRunningFact } from "example-shared/formatting/formatRunningFact";
import { formatSupport } from "example-shared/formatting/formatSupport";
import {
  RUNNING_TONES,
  SUPPORT_TONES,
} from "example-shared/ui/constants/tones";
import { Badge } from "src/components/Badge/Badge";
import { Fact } from "src/components/Fact/Fact";
import { Panel } from "src/components/Panel/Panel";

export const ApplicationPanel: React.FunctionComponent = () => {
  const { diagnostics } = useBeacon();
  const web = useRunning(({ web: fact }) => fact);
  const boot = useRunning(({ boot: identity }) => identity.id);
  const support = useSupport();
  const { counters } = useObservable(diagnostics);

  return (
    <Panel
      title="Application"
      icon={ShieldCheck}
      shows="What executes, and whether the application's own policy accepts it. Neither is rewritten by an offer or a reload request."
    >
      <dl className="grid gap-2 sm:grid-cols-2">
        <Fact
          term="Running"
          hint="Read from the page itself, never from the manifest. Pending means not read yet."
        >
          <span className="flex flex-col items-start gap-1">
            <Badge tone={RUNNING_TONES[web.state]}>{web.state}</Badge>
            <span>{formatRunningFact(web)}</span>
          </span>
        </Fact>
        <Fact
          term="Boot"
          hint="Minted once per document, not per build: it tells one boot from the next."
        >
          {boot}
        </Fact>
        <Fact
          term="Support"
          hint="The application's policy. A failing check never turns supported into unsupported."
        >
          <span className="flex flex-col items-start gap-1">
            <Badge tone={SUPPORT_TONES[support.status]}>{support.status}</Badge>
            <span>{formatSupport(support)}</span>
          </span>
        </Fact>
        <Fact
          term="Remediation"
          hint="The routes that would satisfy the policy, and whether each is usable now."
        >
          {support.evaluation === null ||
          support.evaluation.remediation.length === 0
            ? "none"
            : support.evaluation.remediation
                .map(
                  ({ route, level, usable }) =>
                    `${route} ${level}, ${usable ? "usable now" : "nothing usable yet"}`,
                )
                .join("; ")}
        </Fact>
        <Fact
          term="Contained failures"
          hint="What Beacon dropped or contained instead of throwing into the page."
        >
          {counters.lateCallbacks} late callbacks, {counters.listenerErrors}{" "}
          listener errors, {counters.cleanupErrors} cleanup errors
        </Fact>
      </dl>
    </Panel>
  );
};

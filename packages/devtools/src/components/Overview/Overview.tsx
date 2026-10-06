import { RunningSection } from "src/components/Overview/RunningSection";
import { SupportSection } from "src/components/Overview/SupportSection";
import { TransitionsSection } from "src/components/Overview/TransitionsSection";
import { useObservableValue } from "src/hooks/useObservableValue";
import type { ObservedBeacon } from "src/types/internal/ObservedBeacon";

type OverviewProps = {
  beacon: ObservedBeacon;
  showRaw: boolean;
};

/** What runs, whether it is supported, and what the journal knows: the parts of a Beacon no single route owns. Read only while it is shown. */
export const Overview = (props: OverviewProps) => {
  const running = useObservableValue(() => props.beacon.running);
  const support = useObservableValue(() => props.beacon.support);
  const transitions = useObservableValue(() => props.beacon.transitions);

  return (
    <section class="detail" aria-label="Overview">
      <div class="detail-grid">
        <RunningSection running={running()} showRaw={props.showRaw} />
        <SupportSection support={support()} />
        <TransitionsSection transitions={transitions()} />
      </div>
    </section>
  );
};

import type {
  RunningApplication,
  SupportState,
  TransitionState,
} from "@priemskiyyy/beacon";

import { RunningSection } from "src/components/Overview/RunningSection";
import { SupportSection } from "src/components/Overview/SupportSection";
import { TransitionsSection } from "src/components/Overview/TransitionsSection";

type OverviewProps = {
  running: RunningApplication;
  support: SupportState;
  transitions: TransitionState;
  showRaw: boolean;
};

/** What runs, whether it is supported, and what the journal knows: the parts of a Beacon no single route owns. */
export const Overview = (props: OverviewProps) => (
  <section class="detail" aria-label="Overview">
    <div class="detail-grid">
      <RunningSection running={props.running} showRaw={props.showRaw} />
      <SupportSection support={props.support} />
      <TransitionsSection transitions={props.transitions} />
    </div>
  </section>
);

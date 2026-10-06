import type { TestClock } from "@priemskiyyy/beacon/mock";

export type ReleaseLabOptions = {
  /** The clock every Beacon of the lab runs on; a test passes its own and moves it by hand. */
  clock?: TestClock;
  /** Milliseconds between real-time ticks that move the clock, or `null` to leave it to the caller. */
  tick?: number | null;
  /** Milliseconds the release service takes to answer a read, as a network does; a test leaves it at none. */
  latency?: number;
};

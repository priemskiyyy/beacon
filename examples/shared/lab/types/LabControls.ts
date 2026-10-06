import type { CheckReason, CheckReport } from "@priemskiyyy/beacon";

/**
 * Everything the simulation panel can do to the scripted world, as plain
 * functions. None of them touches Beacon except `check`, which asks it, and
 * `install`, `reset`, which boot another document.
 */
export type LabControls = {
  /** The release service names the next build, and a new document loads it. */
  publish: () => void;
  /** Like `publish`, and the support policy requires that build as its minimum. */
  publishRequired: () => void;
  /** The service names the build before the latest: an ordinary offer for a running newer build. */
  rollBack: () => void;
  /** The service answers that it has no release for this scope. */
  noUpdate: () => void;
  /** The support policy ends the build this document runs. */
  endRunning: () => void;
  setFailing: (failing: boolean) => void;
  /** Reads wait for `answerHeld`, or for their deadline. */
  setSlow: (slow: boolean) => void;
  answerHeld: () => void;
  /** Moves the clock to the instant the last answer stops holding. */
  expire: () => void;
  /** Moves the clock forward and runs the timers that fall due, as a suspended page's return does. */
  skip: (milliseconds: number) => void;
  /** Whether a deployment still serves the old build to a new document. */
  setLagging: (lagging: boolean) => void;
  setDraft: (dirty: boolean) => void;
  check: (reason?: CheckReason) => Promise<CheckReport<"web">>;
  /** Completes the navigation a reload requested: the next document boots what is served now. */
  install: () => void;
  /** A fresh world, an empty journal and a new document. */
  reset: () => void;
};

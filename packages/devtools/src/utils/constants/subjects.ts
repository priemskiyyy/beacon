import type { RunningSubject } from "@priemskiyyy/beacon";

/** The kinds of running code, in the order the panel lists them. `BeaconDevtools.contracts.ts` proves none is left out. */
export const RUNNING_SUBJECTS = [
  "native",
  "bundle",
  "web",
  "worker",
] satisfies RunningSubject[];

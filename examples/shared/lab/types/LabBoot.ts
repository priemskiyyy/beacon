import type { LabBeacon } from "example-shared/lab/types/LabBeacon";

/** One document of the lab: its Beacon, and the build it runs, `null` when it cannot say. */
export type LabBoot = {
  /** Grows with every document the lab boots, and never starts again. */
  number: number;
  build: number | null;
  beacon: LabBeacon;
};

import type { LabBeacon } from "example-shared/lab/types/LabBeacon";

declare module "@priemskiyyy/beacon-svelte" {
  interface Register {
    beacon: LabBeacon;
  }
}

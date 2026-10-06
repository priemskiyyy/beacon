import type { LabBeacon } from "example-shared/lab/types/LabBeacon";

declare module "@priemskiyyy/beacon-solid" {
  interface Register {
    beacon: LabBeacon;
  }
}

import type { LabBeacon } from "example-shared/lab/types/LabBeacon";

declare module "@priemskiyyy/beacon-vue" {
  interface Register {
    beacon: LabBeacon;
  }
}

import type { LabBeacon } from "example-shared/lab/types/LabBeacon";

declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: LabBeacon;
  }
}

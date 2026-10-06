import type { LabBeacon } from "src/beacon.fixture";

// Every test of this package is typed against the Beacon the fixture makes, as an application is against its own.
declare module "@priemskiyyy/beacon-react" {
  interface Register {
    beacon: LabBeacon;
  }
}

import type { WebBeacon } from "src/beacon.fixture";

// Every test of this package is typed against the Beacon the fixture makes, as an application is against its own.
declare module "src/types/Register" {
  interface Register {
    beacon: WebBeacon;
  }
}

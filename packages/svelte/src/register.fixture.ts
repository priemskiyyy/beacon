import type { WebBeacon } from "./beacon.fixture.js";

// Every test of this package is typed against the Beacon the fixture makes, as an application is against its own.
declare module "./types/Register.js" {
  interface Register {
    beacon: WebBeacon;
  }
}

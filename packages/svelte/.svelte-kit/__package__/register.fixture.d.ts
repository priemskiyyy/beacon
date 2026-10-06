import type { WebBeacon } from "./beacon.fixture.js";
declare module "./types/Register.js" {
    interface Register {
        beacon: WebBeacon;
    }
}

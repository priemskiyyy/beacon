import { expect, test } from "vitest";
import * as api from "./index.js";
test("the entry exports the provider and the utilities, and nothing else", () => {
    expect(Object.keys(api).sort()).toEqual([
        "BeaconProvider",
        "useBeacon",
        "useDisruption",
        "useObservable",
        "useRoute",
        "useRunning",
        "useStatus",
        "useSupport",
        "useTransitions",
    ]);
});

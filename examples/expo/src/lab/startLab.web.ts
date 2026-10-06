import { createReleaseLab } from "example-shared/lab/createReleaseLab";
import {
  REQUEST_LATENCY,
  TICK_INTERVAL,
} from "example-shared/lab/constants/lab";
import type { ExpoStart } from "src/lab/types/ExpoStart";

/** The web build runs the scripted lab; `?latency=0` makes its release service answer at once. */
export const startLab = (): ExpoStart => {
  const parameters = new URLSearchParams(window.location.search);

  const lab = createReleaseLab({
    tick: TICK_INTERVAL,
    latency: Number(parameters.get("latency") ?? REQUEST_LATENCY),
  });

  return { kind: "lab", lab, runtime: `web, ${navigator.userAgent}` };
};

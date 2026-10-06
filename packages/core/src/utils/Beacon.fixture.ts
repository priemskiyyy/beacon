import { createTestClock } from "src/mock/createTestClock";
import type { BeaconOptions } from "src/types/BeaconOptions";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningRelease } from "src/types/RunningRelease";
import { Beacon } from "src/utils/Beacon";

export const buildWebRelease = (value: string): RunningRelease => ({
  identity: {
    status: "known",
    authority: "com.example.notes",
    domain: "web-artifact",
    value,
  } satisfies ReleaseIdentity,
  label: `Build ${value}`,
  raw: {},
});

// Lets every queued promise continuation run before the test goes on.
export const settle = () =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, 0);
  });

export const createBeacon = (options: Partial<BeaconOptions> = {}) => {
  const clock = createTestClock({ now: 1_000 });

  const beacon = new Beacon({
    running: { boot: { id: "boot-1" } },
    clock,
    ...options,
  });

  return { beacon, clock };
};

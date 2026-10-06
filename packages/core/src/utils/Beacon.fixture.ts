import { createTestClock } from "src/mock/createTestClock";
import type { TestClock } from "src/mock/types/TestClock";
import type { BeaconOptions } from "src/types/BeaconOptions";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { RouteDefinition } from "src/types/RouteDefinition";
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

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

type Overrides<TRoutes extends Record<string, RouteDefinition>> = Partial<
  Omit<BeaconOptions<TRoutes>, "routes" | "scope">
>;

export const createRoutedBeacon = <
  TRoutes extends Record<string, RouteDefinition>,
>(
  routes: TRoutes,
  options: Overrides<TRoutes> = {},
) => {
  const clock = createTestClock({ now: 1_000 });

  const beacon = new Beacon<TRoutes>({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes,
    clock,
    ...options,
  });

  return { beacon, clock };
};

// A host clock that cannot arm a timer while `state.broken` holds, as one that ran out of timers or was torn down; its `now` and the timers it did arm still work.
export const createBrokenClock = () => {
  const inner = createTestClock({ now: 1_000 });
  const state = { broken: true };

  const clock: TestClock = {
    ...inner,
    setTimer: (callback, delay) => {
      if (state.broken) {
        throw new Error("The clock cannot arm a timer.");
      }

      return inner.setTimer(callback, delay);
    },
  };

  return { clock, state };
};

export const createBeacon = (options: Overrides<Record<never, never>> = {}) =>
  createRoutedBeacon({}, options);

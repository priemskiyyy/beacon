import { Beacon } from "src/utils/Beacon";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { targetRoute } from "src/utils/targetRoute";
import type { BeaconDiagnosticEvent } from "src/types/BeaconDiagnosticEvent";
import type { NoneDecision } from "src/types/NoneDecision";
import type { ProviderResult } from "src/types/ProviderResult";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { TargetDecision } from "src/types/TargetDecision";
import { createMockSource } from "src/mock/createMockSource";
import { createTestClock } from "src/mock/createTestClock";
import { vi } from "vitest";

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "ios",
  distribution: "app-store",
};

type Manifest = { bundle: TargetDecision | NoneDecision };

const identity = (value: string): ReleaseIdentity => ({
  status: "known",
  authority: SCOPE.application,
  domain: "update",
  value,
});

export const deploy = (value: string): Manifest => ({
  bundle: { kind: "target", release: { identity: identity(value) } },
});

// One route over the mock source and the test clock, and the reason of every check that was started. `canArm` says whether the Beacon's clock can arm a timer at the moment.
export const createTestBeacon = ({
  canArm = () => true,
}: { canArm?: () => boolean } = {}) => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const clock = createTestClock({ now: 1_000_000 });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      bundle: () => ({ identity: identity("update-1"), label: null, raw: {} }),
    },
    routes: {
      bundle: targetRoute({
        source: mock.source.select((manifest) => manifest.bundle),
        mechanism: createUpdateMechanism({
          name: "restart",
          subject: "bundle",
          open: () => ({ native: {} }),
          commands: {
            restart: {
              reference: "offer",
              impacts: ["javascript-restart"],
              binding: "unpinned-navigation",
              run: async (): Promise<
                ProviderResult<{ kind: "restart-requested" }>
              > => ({
                status: "accepted",
                receipt: { kind: "restart-requested" },
              }),
            },
          },
        }),
      }),
    },
    clock: {
      now: clock.now,
      setTimer: (callback, delay) => {
        if (!canArm()) {
          throw new Error("The clock cannot arm a timer.");
        }

        return clock.setTimer(callback, delay);
      },
    },
  });

  const events: BeaconDiagnosticEvent[] = [];

  beacon.diagnostics.events.subscribe((event) => {
    events.push(event);
  });

  return {
    beacon,
    mock,
    clock,
    reasons: () =>
      events.flatMap((event) => {
        if (event.type !== "check-started") {
          return [];
        }

        return [event.reason];
      }),
  };
};

// How many subscriptions to the route's state are open, which the core does not say.
export const countRouteSubscriptions = (
  beacon: ReturnType<typeof createTestBeacon>["beacon"],
) => {
  const route = beacon.route;
  const count = { open: 0 };

  vi.spyOn(beacon, "route").mockImplementation((name) => {
    const handle = route(name);

    return {
      ...handle,
      state: {
        ...handle.state,
        subscribe: (listener: () => void) => {
          count.open += 1;

          const stop = handle.state.subscribe(listener);

          return () => {
            count.open -= 1;
            stop();
          };
        },
      },
    };
  });

  return () => count.open;
};

import {
  Beacon,
  createReleaseDriver,
  createUpdateMechanism,
  targetRoute,
} from "@priemskiyyy/beacon";
import type {
  NoneDecision,
  ObservableValue,
  ReleaseIdentity,
  ReleaseScope,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";

const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

const buildIdentity = (value: string): ReleaseIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value,
});

export const target = (value: string): TargetDecision => ({
  kind: "target",
  release: { identity: buildIdentity(value), label: `Build ${value}` },
});

// A web route over one mock manifest, with build B running and an inert mechanism.
export const createWebBeacon = () => {
  const mock = createMockSource<{ web: TargetDecision | NoneDecision }>({
    name: "manifest",
  });

  const web = targetRoute({
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "inert",
      subject: "web",
      open: () => ({ native: {} }),
      commands: {
        prefetch: {
          reference: "none",
          impacts: ["document-replacement"],
          binding: "provider-current",
          run: async () => ({
            status: "accepted",
            receipt: { kind: "prefetched" },
          }),
        },
      },
    }),
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      web: () => ({
        identity: buildIdentity("web-build-b"),
        label: "Build web-build-b",
        raw: {},
      }),
    },
    routes: { web },
    clock: createTestClock({ now: 1_000 }),
  });

  return { beacon, mock };
};

export type WebBeacon = ReturnType<typeof createWebBeacon>["beacon"];

// A copy of an observable that counts its live listeners, which is what a leak looks like.
export const countListeners = <TValue>(value: ObservableValue<TValue>) => {
  const counts = { live: 0 };

  const observable: ObservableValue<TValue> = {
    get: value.get,
    getInitial: value.getInitial,
    subscribe: (listener) => {
      counts.live += 1;

      const unsubscribe = value.subscribe(listener);

      return () => {
        counts.live -= 1;
        unsubscribe();
      };
    },
  };

  return { observable, listeners: () => counts.live };
};

// A Beacon over a provider's driver route with a native handle, which is what an Expo application has, for what a hook must accept besides a feed route.
export const createDriverBeacon = () =>
  new Beacon({
    scope: SCOPE,
    running: { boot: { id: "boot-1" } },
    routes: {
      ota: createReleaseDriver({
        name: "ota",
        subject: "bundle",
        prepares: false,
        open: () => ({
          native: { channel: "production" },
          check: async () => ({
            status: "none",
            reason: "no-decision",
            detail: null,
          }),
        }),
        commands: {},
      }),
    },
  });

export type DriverBeacon = ReturnType<typeof createDriverBeacon>;

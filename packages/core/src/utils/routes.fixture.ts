import { createMockSource } from "src/mock/createMockSource";
import type { NoneDecision } from "src/types/NoneDecision";
import type { ProviderResult } from "src/types/ProviderResult";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { TargetDecision } from "src/types/TargetDecision";
import { createRoutedBeacon } from "src/utils/Beacon.fixture";
import { buildWebRelease } from "src/utils/Beacon.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { targetRoute } from "src/utils/targetRoute";
import type { BeaconOptions } from "src/types/BeaconOptions";

export type Manifest = {
  web: TargetDecision | NoneDecision;
  policy: { minimum: string };
};

export type ReloadReceipt = { kind: "reload-requested" };

export const buildWebIdentity = (value: string): ReleaseIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value,
});

export const target = (value: string): TargetDecision => ({
  kind: "target",
  release: { identity: buildWebIdentity(value), label: `Build ${value}` },
});

export const createReloadMechanism = () => {
  const environment = { reloads: 0 };

  const mechanism = createUpdateMechanism({
    name: "test-reload",
    open: () => ({ native: environment }),
    commands: {
      reload: {
        reference: "offer",
        impacts: ["document-replacement"],
        binding: "unpinned-navigation",
        run: async ({ native }): Promise<ProviderResult<ReloadReceipt>> => {
          native.reloads += 1;

          return { status: "accepted", receipt: { kind: "reload-requested" } };
        },
      },
    },
  });

  return { mechanism, environment };
};

type WebOptions = Partial<
  Omit<BeaconOptions<Record<never, never>>, "routes" | "scope">
>;

// A web route over one mock manifest, with build B running.
export const createWebBeacon = (options: WebOptions = {}) => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const { mechanism, environment } = createReloadMechanism();

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism,
  });

  const context = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease("web-build-b"),
      },
      ...options,
    },
  );

  return { ...context, mock, environment, web };
};

export type SharedManifest = {
  first: TargetDecision | NoneDecision;
  second: TargetDecision | NoneDecision;
};

// Two web routes over one mock source, with build B running.
export const createTwoRouteBeacon = () => {
  const mock = createMockSource<SharedManifest>({ name: "manifest" });
  const { mechanism } = createReloadMechanism();

  const first = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.first),
    mechanism,
  });

  const second = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.second),
    mechanism,
  });

  const context = createRoutedBeacon(
    { first, second },
    {
      running: {
        boot: { id: "boot-1" },
        web: () => buildWebRelease("web-build-b"),
      },
    },
  );

  return { ...context, mock };
};

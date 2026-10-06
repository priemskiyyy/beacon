import {
  Beacon,
  createReleaseDriver,
  createUpdateMechanism,
  newerRoute,
  supportPolicy,
  targetRoute,
} from "@priemskiyyy/beacon";
import type {
  CandidateDecision,
  JournalStorage,
  NoneDecision,
  ProviderResult,
  ReleaseIdentity,
  ReleaseScope,
  RouteBody,
  RunningApplication,
  RunningRelease,
  SupportVerdict,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { createMockSource, createTestClock } from "@priemskiyyy/beacon/mock";
import { integer } from "@priemskiyyy/beacon/versions";

export const SCOPE: ReleaseScope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

type Support = { minimumBuild: number; deprecatedBelow: number };

export type LabManifest = {
  web: TargetDecision | NoneDecision;
  binary: CandidateDecision<number> | NoneDecision;
  support: Support;
};

type Receipt = { kind: "reload-requested" };

type OtaNative = {
  label: string;
  apiToken: string;
  nested: { password: string; channel: string };
};

// A secret in the running facts and in the provider's handle, to prove the panel never prints one.
export const SECRETS = {
  running: "running-secret-value",
  cookie: "cookie-secret-value",
  native: "native-secret-value",
  password: "password-secret-value",
};

export const webIdentity = (value: string): ReleaseIdentity => ({
  status: "known",
  authority: "com.example.notes",
  domain: "web-artifact",
  value,
});

export const target = (value: string): TargetDecision => ({
  kind: "target",
  release: { identity: webIdentity(value), label: `Build ${value}` },
});

export const candidate = (build: number): CandidateDecision<number> => ({
  kind: "candidate",
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "android-version-code",
      value: String(build),
    },
    label: `Build ${build}`,
    order: build,
  },
});

export const buildDocument = (
  overrides: Partial<LabManifest> = {},
): LabManifest => ({
  web: target("web-build-a"),
  binary: candidate(120),
  support: { minimumBuild: 108, deprecatedBelow: 112 },
  ...overrides,
});

/** A manifest that has nothing to offer for any route. */
export const quietDocument = (): LabManifest =>
  buildDocument({
    web: { kind: "none", reason: "up-to-date" },
    binary: { kind: "none", reason: "up-to-date" },
  });

const evaluateSupport = (
  support: Support,
  running: RunningApplication,
): SupportVerdict<"binary" | "web"> => {
  if (running.native.state !== "known") {
    return {
      status: "unknown",
      reasons: [{ code: "native-build-unknown", subject: "native" }],
      remediation: [],
    };
  }

  const build = Number(running.native.release.raw["build"]);

  if (build < support.minimumBuild) {
    return {
      status: "unsupported",
      reasons: [{ code: "native-build-too-old", subject: "native" }],
      remediation: [{ route: "binary", level: "required" }],
    };
  }

  return { status: "supported", reasons: [], remediation: [] };
};

const nativeRelease: RunningRelease = {
  identity: {
    status: "known",
    authority: "com.example.notes",
    domain: "android-version-code",
    value: "100",
  },
  label: "Build 100",
  raw: { build: 100, versionName: "1.0.0", apiToken: SECRETS.running },
};

const webRelease: RunningRelease = {
  identity: webIdentity("web-build-b"),
  label: "Build web-build-b",
  raw: { revision: "abc", cookie: SECRETS.cookie },
};

// A journal that keeps what it is given in memory.
const createMemoryStorage = () => {
  const data = new Map<string, string>();

  const storage: JournalStorage = {
    read: async (key) => data.get(key) ?? null,
    write: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };

  return { storage, data };
};

const OTA_BODY: RouteBody = {
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "ota-update",
      value: "ota-7",
    },
    label: "Update seven",
  },
};

type HeldReload = { settle: (result: ProviderResult<Receipt>) => void };

// A release lab in the shape of an application: two feed routes over one manifest, a provider route that prepares, a support policy and a journal, on a clock the test moves.
export const createLabBeacon = ({
  journal = true,
}: { journal?: boolean } = {}) => {
  const mock = createMockSource<LabManifest>({ name: "manifest" });
  const clock = createTestClock({ now: 1_700_000_000_000 });
  const memory = createMemoryStorage();
  const commands = { reloads: 0, prefetches: 0, downloads: 0 };
  const held: HeldReload[] = [];

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: createUpdateMechanism({
      name: "held-reload",
      open: () => ({ native: {} }),
      commands: {
        reload: {
          reference: "offer",
          impacts: ["document-replacement", "javascript-restart"],
          binding: "unpinned-navigation",
          run: () => {
            commands.reloads += 1;

            return new Promise<ProviderResult<Receipt>>((resolve) => {
              held.push({ settle: resolve });
            });
          },
        },
      },
    }),
  });

  const binary = newerRoute({
    subject: "native",
    source: mock.source.select((manifest) => manifest.binary),
    version: integer(),
    current: (release) => Number(release?.raw["build"] ?? Number.NaN),
    mechanism: createUpdateMechanism({
      name: "store",
      open: () => ({ native: {} }),
      commands: {
        prefetch: {
          reference: "none",
          impacts: ["may-activate-on-next-start"],
          binding: "provider-current",
          run: async () => {
            commands.prefetches += 1;

            return { status: "accepted", receipt: { kind: "prefetched" } };
          },
        },
      },
    }),
  });

  const emitters: Array<{
    prepared: (draft: { status: "ready"; value: RouteBody }) => void;
  }> = [];

  const otaNative: OtaNative = {
    label: "fake provider",
    apiToken: SECRETS.native,
    nested: { password: SECRETS.password, channel: "stable" },
  };

  const ota = createReleaseDriver<
    OtaNative,
    RouteBody,
    RouteBody,
    {
      download: {
        reference: "offer";
        impacts: [];
        binding: "provider-current";
        run(context: {
          native: OtaNative;
          signal: AbortSignal;
          parameters: Record<never, never>;
          offer: RouteBody;
        }): Promise<ProviderResult<{ kind: "downloaded" }>>;
      };
    }
  >({
    name: "fake-provider",
    subject: "bundle",
    prepares: true,
    open: ({ emit }) => {
      emitters.push(emit);

      return {
        native: otaNative,
        check: async () => ({ status: "available", offer: OTA_BODY }),
      };
    },
    commands: {
      download: {
        reference: "offer",
        impacts: [],
        binding: "provider-current",
        run: async () => {
          commands.downloads += 1;

          return { status: "accepted", receipt: { kind: "downloaded" } };
        },
      },
    },
  });

  const beacon = new Beacon({
    scope: SCOPE,
    running: {
      boot: { id: "boot-1" },
      native: () => nativeRelease,
      web: () => webRelease,
    },
    routes: { web, binary, ota },
    policy: supportPolicy({
      source: mock.source.select((manifest) => manifest.support),
      evaluate: evaluateSupport,
    }),
    ...(journal
      ? { journal: { mode: "best-effort", storage: memory.storage } }
      : {}),
    clock,
  });

  return {
    beacon,
    clock,
    mock,
    commands,
    journal: memory.data,
    /** Settles the oldest held reload the provider was asked for. */
    settleReload: (result: ProviderResult<Receipt>) =>
      held.shift()?.settle(result),
    /** Makes the provider report a prepared target. */
    prepare: () =>
      emitters.at(-1)?.prepared({ status: "ready", value: OTA_BODY }),
    /** Answers the next read of the manifest, and every one after it. */
    answer: (document: LabManifest = buildDocument()) => {
      mock.answer({
        document,
        revision: { kind: "opaque", value: "rev-1" },
        issuer: "release-service",
        expiresAt: 1_700_000_600_000,
      });
    },
  };
};

export type LabBeacon = ReturnType<typeof createLabBeacon>["beacon"];

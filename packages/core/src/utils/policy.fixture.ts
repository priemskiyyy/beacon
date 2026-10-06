import { createMockSource } from "src/mock/createMockSource";
import type { CandidateDecision } from "src/types/CandidateDecision";
import type { NoneDecision } from "src/types/NoneDecision";
import type { ReleaseIdentity } from "src/types/ReleaseIdentity";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningRelease } from "src/types/RunningRelease";
import type { SupportVerdict } from "src/types/SupportVerdict";
import type { TargetDecision } from "src/types/TargetDecision";
import { buildWebRelease, createRoutedBeacon } from "src/utils/Beacon.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { integer } from "src/utils/versions/integer";
import { newerRoute } from "src/utils/newerRoute";
import { supportPolicy } from "src/utils/supportPolicy";
import { target } from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";

export type Support = { minimumBuild: number; deprecatedBelow: number };

export type PolicyManifest = {
  web: TargetDecision | NoneDecision;
  binary: CandidateDecision<number> | NoneDecision;
  support: Support;
};

export const buildNativeRelease = (build: number): RunningRelease => {
  const identity: ReleaseIdentity = {
    status: "known",
    authority: "com.example.notes",
    domain: "android-version-code",
    value: String(build),
  };

  return { identity, label: `Build ${build}`, raw: { build } };
};

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

// The application's own evaluation: a running native build under a minimum is unsupported, and one under a threshold is deprecated.
export const evaluateSupport = (
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

  if (build < support.deprecatedBelow) {
    return {
      status: "deprecated",
      reasons: [{ code: "native-build-old", subject: "native" }],
      remediation: [{ route: "binary", level: "recommended" }],
    };
  }

  return { status: "supported", reasons: [], remediation: [] };
};

export const buildDocument = (
  overrides: Partial<PolicyManifest> = {},
): PolicyManifest => ({
  web: target("web-build-a"),
  binary: candidate(120),
  support: { minimumBuild: 108, deprecatedBelow: 100 },
  ...overrides,
});

export const createPolicyRoutes = (
  mock: ReturnType<typeof createMockSource<PolicyManifest>>,
) => {
  const inert = createUpdateMechanism({
    name: "inert",
    open: () => ({ native: {} }),
    commands: {
      prefetch: {
        reference: "none",
        impacts: ["may-activate-on-next-start"],
        binding: "provider-current",
        run: async () => ({
          status: "accepted",
          receipt: { kind: "prefetched" },
        }),
      },
    },
  });

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: inert,
  });

  const binary = newerRoute({
    subject: "native",
    source: mock.source.select((manifest) => manifest.binary),
    version: integer(),
    current: (release) => Number(release?.raw["build"] ?? Number.NaN),
    mechanism: inert,
  });

  return { web, binary };
};

type Options = {
  build?: number;
  evaluate?: typeof evaluateSupport;
  /** Leaves the native reader unanswered, as a slow native module does. */
  holdNative?: boolean;
};

// A web route, a binary route and a support policy over one manifest, with native build 100 running.
export const createPolicyBeacon = ({
  build = 100,
  evaluate = evaluateSupport,
  holdNative = false,
}: Options = {}) => {
  const mock = createMockSource<PolicyManifest>({ name: "manifest" });

  const running = {
    native: buildNativeRelease(build),
    web: buildWebRelease("web-build-b"),
  };

  const policy = supportPolicy({
    source: mock.source.select((manifest) => manifest.support),
    evaluate,
  });

  const context = createRoutedBeacon(createPolicyRoutes(mock), {
    running: {
      boot: { id: "boot-1" },
      web: () => running.web,
      native: () => {
        if (holdNative) {
          return new Promise<RunningRelease>(() => {});
        }

        return running.native;
      },
    },
    policy,
  });

  return { ...context, mock, running };
};

export const answer = (
  mock: ReturnType<typeof createPolicyBeacon>["mock"],
  document: PolicyManifest,
  expiresAt: number | undefined = 601_000,
) => {
  mock.resolve({
    document,
    revision: { kind: "opaque", value: JSON.stringify(document.support) },
    ...(expiresAt === undefined ? {} : { expiresAt }),
  });
};

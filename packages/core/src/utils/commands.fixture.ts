import { createMockSource } from "src/mock/createMockSource";
import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconOptions } from "src/types/BeaconOptions";
import type { DisruptionParticipant } from "src/types/DisruptionParticipant";
import type { JournalOptions } from "src/types/JournalOptions";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RunningRelease } from "src/types/RunningRelease";
import type { ReserveResult } from "src/types/ReserveResult";
import type { Settlement } from "src/types/Settlement";
import { buildWebRelease, createRoutedBeacon } from "src/utils/Beacon.fixture";
import { createUpdateMechanism } from "src/utils/createUpdateMechanism";
import { settle } from "src/mock/settle";
import { target } from "src/utils/routes.fixture";
import type {
  Manifest,
  ReloadReceipt,
  SharedManifest,
} from "src/utils/routes.fixture";
import { targetRoute } from "src/utils/targetRoute";

export const ACCEPTED_RELOAD: ProviderResult<ReloadReceipt> = {
  status: "accepted",
  receipt: { kind: "reload-requested" },
};

type WarmReceipt = { kind: "warmed" };

type HeldRun = {
  signal: AbortSignal;
  /** Whether the caller had already given up when the provider was asked. */
  abortedOnArrival: boolean;
  settleWith: (result: ProviderResult<ReloadReceipt>) => void;
  fail: (error: Error) => void;
};

// A mechanism whose reload is held until the test settles it, so a test decides exactly what interleaves with it.
export const createHeldMechanism = ({
  failOpen = false,
}: { failOpen?: boolean } = {}) => {
  const runs: HeldRun[] = [];
  const warmed = { count: 0 };

  const mechanism = createUpdateMechanism({
    name: "held",
    open: () => {
      if (failOpen) {
        throw new Error("The provider could not be opened.");
      }

      return { native: {} };
    },
    commands: {
      reload: {
        reference: "offer",
        impacts: ["document-replacement"],
        binding: "unpinned-navigation",
        run: ({ signal }) =>
          new Promise<ProviderResult<ReloadReceipt>>((resolve, reject) => {
            runs.push({
              signal,
              abortedOnArrival: signal.aborted,
              settleWith: resolve,
              fail: reject,
            });
          }),
      },
      // Reloads whatever is deployed, so no offer names a target.
      refresh: {
        reference: "none",
        impacts: ["document-replacement"],
        binding: "unpinned-navigation",
        run: async (): Promise<ProviderResult<ReloadReceipt>> =>
          ACCEPTED_RELOAD,
      },
      prefetch: {
        reference: "none",
        impacts: ["may-activate-on-next-start"],
        binding: "provider-current",
        run: async (): Promise<ProviderResult<WarmReceipt>> => {
          warmed.count += 1;

          return { status: "accepted", receipt: { kind: "warmed" } };
        },
      },
    },
  });

  return { mechanism, runs, warmed };
};

// The oldest reload the provider was asked for, or a failure that names the missing call.
export const takeRun = (runs: HeldRun[]) => {
  const run = runs.shift();

  if (run === undefined) {
    throw new Error("The provider was not asked to reload.");
  }

  return run;
};

type WebCommandOptions = {
  /** The id of the boot, for a test that starts the same application again. */
  boot?: string;
  /** The web build that runs, or `null` when nothing names it. */
  build?: string | null;
  /** Makes the web reader fail, so that no fact about the web build is known. */
  failRead?: boolean;
  /** Makes the mechanism fail to open, so the route has no provider. */
  failOpen?: boolean;
  journal?: JournalOptions;
  /** The host clock, for a test that does what the test clock never does. */
  clock?: BeaconClock;
  /** Reads the web build instead of `build` and `failRead`, for a reader that answers late. */
  reader?: () => RunningRelease | Promise<RunningRelease>;
  timeouts?: BeaconOptions<Record<never, never>>["timeouts"];
};

const UNNAMED_WEB_RELEASE: RunningRelease = {
  identity: { status: "unknown", reason: "unnamed-build" },
  label: null,
  raw: {},
};

export const createWebCommandBeacon = ({
  boot = "boot-1",
  build = "web-build-b",
  failRead = false,
  failOpen = false,
  journal,
  clock,
  reader,
  timeouts,
}: WebCommandOptions = {}) => {
  const mock = createMockSource<Manifest>({ name: "manifest" });
  const held = createHeldMechanism({ failOpen });

  const web = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.web),
    mechanism: held.mechanism,
  });

  const context = createRoutedBeacon(
    { web },
    {
      running: {
        boot: { id: boot },
        web:
          reader ??
          (() => {
            if (failRead) {
              throw new Error("The web build could not be read.");
            }

            if (build === null) {
              return UNNAMED_WEB_RELEASE;
            }

            return buildWebRelease(build);
          }),
      },
      ...(journal === undefined ? {} : { journal }),
      ...(clock === undefined ? {} : { clock }),
      ...(timeouts === undefined ? {} : { timeouts }),
    },
  );

  return { ...context, mock, ...held };
};

export const answerWithBuild = (
  mock: ReturnType<typeof createWebCommandBeacon>["mock"],
  build: string,
  revision: string,
) => {
  mock.resolve({
    document: {
      web: target(build),
      policy: { minimum: "1.0.0" },
    },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: revision },
    digest: build,
    expiresAt: 601_000,
  });
};

// Starts the Beacon, checks the web route once, and answers the offer the user would be shown.
export const startWithOffer = async (
  context: ReturnType<typeof createWebCommandBeacon>,
) => {
  context.beacon.start();

  const checking = context.beacon.route("web").check();

  await settle();
  answerWithBuild(context.mock, "web-build-a", "208");
  await checking;

  const { observation } = context.beacon.route("web").state.get();

  if (observation.status !== "available") {
    throw new Error("The web route has no offer.");
  }

  return observation.offer.ref;
};

// Two web routes over one source, sharing one held mechanism, with build B running.
export const createTwoRouteCommandBeacon = () => {
  const mock = createMockSource<SharedManifest>({ name: "manifest" });
  const held = createHeldMechanism();

  const first = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.first),
    mechanism: held.mechanism,
  });

  const second = targetRoute({
    subject: "web",
    source: mock.source.select((manifest) => manifest.second),
    mechanism: held.mechanism,
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

  return { ...context, mock, ...held };
};

// Starts the Beacon and answers one check for both routes, each with its own offer.
export const startWithOffers = async (
  context: ReturnType<typeof createTwoRouteCommandBeacon>,
) => {
  context.beacon.start();

  const checking = context.beacon.check();

  await settle();
  context.mock.resolve({
    document: {
      first: target("web-build-a"),
      second: target("web-build-c"),
    },
    revision: { kind: "ordered", domain: "web", epoch: "v1", value: "208" },
    digest: "a",
    expiresAt: 601_000,
  });
  await checking;

  const first = context.beacon.route("first").state.get().observation;
  const second = context.beacon.route("second").state.get().observation;

  if (first.status !== "available" || second.status !== "available") {
    throw new Error("A route has no offer.");
  }

  return { first: first.offer.ref, second: second.offer.ref };
};

type ParticipantOptions = {
  impacts?: DisruptionParticipant["impacts"];
  reserve?: () => ReserveResult;
  settlement?: () => Promise<Settlement>;
};

// A participant that writes what it is asked into `log`, so the order of a coordination is an assertion.
export const createParticipant = (
  name: string,
  log: string[],
  {
    impacts = ["document-replacement"],
    reserve,
    settlement,
  }: ParticipantOptions = {},
): DisruptionParticipant => ({
  name,
  impacts,
  reserve: () => {
    log.push(`${name}:reserve`);

    if (reserve !== undefined) {
      return reserve();
    }

    return {
      status: "reserved",
      settle: async () => {
        log.push(`${name}:settle`);

        if (settlement !== undefined) {
          return settlement();
        }

        return { status: "ready" };
      },
      release: () => {
        log.push(`${name}:release`);
      },
    };
  },
});

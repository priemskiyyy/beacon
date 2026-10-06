import type { DriverEmitter } from "src/types/DriverEmitter";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { ProviderResult } from "src/types/ProviderResult";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningReader } from "src/types/RunningReader";
import { createRoutedBeacon } from "src/utils/Beacon.fixture";
import { createReleaseDriver } from "src/utils/createReleaseDriver";

export type FakeNative = { label: string };

export const BODY: RouteBody = {
  release: {
    identity: {
      status: "known",
      authority: "com.example.notes",
      domain: "android-version-code",
      value: "120",
    },
  },
};

type HeldDownload = {
  signal: AbortSignal;
  settleWith: (result: ProviderResult<{ kind: "downloaded" }>) => void;
};

type Script = {
  /** What `check` answers, an offer of `BODY` by default. */
  answers: ObservationDraft<RouteBody>;
  /** Makes `open` throw, as a provider that cannot start does. */
  failOpen: Error | null;
  /** What `open` reports at once, before it returns, as a provider whose callbacks are synchronous does. */
  emitOnOpen: ObservationDraft<RouteBody> | null;
  /** What `reconcile` does, given the signal of its session: throw before it returns, reject later or report. Without it the provider has none. */
  reconcile: (signal: AbortSignal) => Promise<void>;
  /** Makes `dispose` throw, as a provider whose unsubscribe fails does. */
  throwOnDispose: Error | null;
  /** The reader of the provider's own subject that the driver offers by default, which it has none of unless a test gives one. */
  running: RunningReader;
};

// A provider driver whose session, emitter and commands a test controls.
export const createFakeDriver = (
  script: Partial<Script> = {},
  exclusive: object | null = null,
) => {
  const { reconcile, running } = script;

  const answers: ObservationDraft<RouteBody> = script.answers ?? {
    status: "available",
    offer: BODY,
  };

  const counts = { opens: 0, disposals: 0 };
  const emitters: Array<DriverEmitter<RouteBody, RouteBody>> = [];
  const downloads: HeldDownload[] = [];
  const native: FakeNative = { label: "fake provider" };

  const route = createReleaseDriver<
    FakeNative,
    RouteBody,
    RouteBody,
    {
      download: {
        reference: "offer";
        impacts: [];
        binding: "provider-current";
        run(
          context: {
            native: FakeNative;
            signal: AbortSignal;
            parameters: Record<never, never>;
          } & { offer: RouteBody },
        ): Promise<ProviderResult<{ kind: "downloaded" }>>;
      };
    }
  >({
    name: "fake-driver",
    subject: "native",
    prepares: true,
    ...(exclusive === null ? {} : { exclusive }),
    ...(running === undefined ? {} : { running }),
    open: ({ emit }) => {
      counts.opens += 1;

      if (script.failOpen !== undefined && script.failOpen !== null) {
        throw script.failOpen;
      }

      emitters.push(emit);

      if (script.emitOnOpen !== undefined && script.emitOnOpen !== null) {
        emit.observation(script.emitOnOpen);
      }

      return {
        native,
        check: async () => answers,
        ...(reconcile === undefined
          ? {}
          : {
              reconcile: ({ signal }: { signal: AbortSignal }) =>
                reconcile(signal),
            }),
        dispose: () => {
          counts.disposals += 1;

          const failure = script.throwOnDispose ?? null;

          if (failure === null) {
            return;
          }

          throw failure;
        },
      };
    },
    commands: {
      download: {
        reference: "offer",
        impacts: [],
        binding: "provider-current",
        run: ({ signal }) =>
          new Promise<ProviderResult<{ kind: "downloaded" }>>((resolve) => {
            downloads.push({ signal, settleWith: resolve });
          }),
      },
    },
  });

  return {
    route,
    counts,
    native,
    downloads,
    /** The emitter of the session opened last. */
    emitter: () => emitters.at(-1),
  };
};

export const createDriverBeacon = (
  script: Partial<Script> = {},
  exclusive: object | null = null,
) => {
  const driver = createFakeDriver(script, exclusive);
  const context = createRoutedBeacon({ ota: driver.route });

  return { ...context, ...driver, ota: context.beacon.route("ota") };
};

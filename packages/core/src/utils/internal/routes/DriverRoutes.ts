import type { DriverContext } from "src/types/DriverContext";
import type { DriverEntry } from "src/types/internal/DriverEntry";
import type { DriverSession } from "src/types/DriverSession";
import type { ErasedDriver } from "src/types/internal/ErasedDriver";
import type { RouteGroupOptions } from "src/types/internal/RouteGroupOptions";
import type { RouteRuntime } from "src/types/internal/RouteRuntime";
import type { SharedReadErrors } from "src/types/internal/SharedReadErrors";
import type { Session } from "src/types/internal/Session";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { PreparedDraft } from "src/types/PreparedDraft";
import type { RouteBody } from "src/types/RouteBody";
import { BeaconError } from "src/utils/BeaconError";
import { createEvidence } from "src/utils/internal/feeds/createEvidence";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { SharedRead } from "src/utils/internal/reads/SharedRead";
import { claimExclusive } from "src/utils/internal/routes/claimExclusive";
import type { RouteRecord } from "src/utils/internal/routes/RouteRecord";
import { toCheckOutcome } from "src/utils/internal/routes/toCheckOutcome";

type RoutedDriver = { name: string; record: RouteRecord; driver: ErasedDriver };

/**
 * Owns the routes a provider answers for: each one's shared check, and the
 * driver session that answers it while a session is open.
 */
export class DriverRoutes {
  #options: RouteGroupOptions;

  constructor(options: RouteGroupOptions) {
    this.#options = options;
  }

  /** Builds the shared check of a route, and answers how it opens and is checked. */
  add = (route: RoutedDriver): RouteRuntime => {
    const { clock, timeout, commit } = this.#options;
    const { driver } = route;

    const failure: SharedReadErrors["failed"] = {
      code: "DRIVER_FAILED",
      message: "A provider could not be checked.",
    };

    const entry: DriverEntry = {
      session: null,
      read: new SharedRead<
        ObservationDraft<RouteBody>,
        ObservationDraft<RouteBody>
      >({
        clock,
        timeout,
        perform: ({ signal }) => this.#ask(entry, signal),
        accept: (_attempt, draft) => draft,
        hooks: {
          started: (attempt) =>
            commit((transaction) =>
              route.record.beginCheck(transaction, attempt),
            ),
          accepted: (attempt, draft) =>
            commit((transaction) => {
              route.record.installDraft(
                transaction,
                draft,
                this.#createEvidence(driver.name),
              );
              route.record.settleCheck(transaction, attempt, null);
            }),
          failed: (attempt, error) =>
            commit((transaction) =>
              route.record.settleCheck(transaction, attempt, error),
            ),
          record: this.#options.record,
        },
        errors: {
          failed: failure,
          invalid: failure,
          timeout: {
            code: "SOURCE_TIMEOUT",
            message: "A provider did not answer in time.",
          },
        },
      }),
    };

    return {
      dependsOn: [],
      open: (session) => this.#open(route, entry, session),
      check: async (session, options) =>
        toCheckOutcome(await entry.read.read(session, options), null),
    };
  };

  #recordFailure(route: string) {
    this.#options.record("route-failed", { route, reason: "DRIVER_FAILED" });
  }

  #ask(entry: DriverEntry, signal: AbortSignal) {
    if (entry.session === null) {
      throw new BeaconError({
        code: "DRIVER_FAILED",
        message: "The provider is not open.",
      });
    }

    return entry.session.check({ signal });
  }

  #createEvidence(source: string) {
    return createEvidence({
      source,
      origin: "provider",
      receivedAt: this.#options.clock.now(),
      expiresAt: null,
      issuer: null,
      revision: null,
    });
  }

  #open(route: RoutedDriver, entry: DriverEntry, session: Session) {
    const { name, record, driver } = route;
    const { commit } = this.#options;

    const release = this.#claimManager(route);

    if (release === null) {
      return;
    }

    let opened: DriverSession<object, RouteBody>;

    try {
      opened = driver.open(this.#createContext(route, session));
    } catch {
      release();
      this.#recordFailure(name);

      return;
    }

    entry.session = opened;

    commit((transaction) => record.installNative(transaction, opened.native));

    const controller = new AbortController();

    session.resources.add(() => {
      controller.abort();
      entry.session = null;
      commit((transaction) => record.installNative(transaction, null));

      // The manager goes back even when the provider fails to let go of it.
      try {
        opened.dispose?.();
      } finally {
        release();
      }
    });

    this.#reconcile(route, opened, controller.signal);
  }

  // A manager one session holds is never opened by another: the route fails to open instead of racing for it.
  #claimManager({ name, driver }: RoutedDriver) {
    if (driver.exclusive === undefined) {
      return () => {};
    }

    const release = claimExclusive(driver.exclusive);

    if (release === null) {
      this.#recordFailure(name);
    }

    return release;
  }

  // Reads the provider's current local state, as it stands after a restart; a failure is contained.
  #reconcile(
    { name }: RoutedDriver,
    opened: DriverSession<object, RouteBody>,
    signal: AbortSignal,
  ) {
    const { reconcile } = opened;

    // A listener told that the provider opened may have ended the session already.
    if (reconcile === undefined || signal.aborted) {
      return;
    }

    // The executor runs at once, so a provider that reports while it reconciles is heard, and one that throws is contained like one that rejects.
    new Promise<void>((resolve) => resolve(reconcile({ signal }))).catch(() => {
      // A provider that gives up because its session ended has not failed.
      if (signal.aborted) {
        this.#options.record("late-callback", {
          route: name,
          reason: "driver",
        });

        return;
      }

      this.#recordFailure(name);
    });
  }

  #createContext(
    { name, record, driver }: RoutedDriver,
    session: Session,
  ): DriverContext<RouteBody, RouteBody> {
    const { getScope, running, commit } = this.#options;

    // A report from a session that ended is counted and dropped, and one Beacon cannot take is a failed route, never a throw into the provider.
    const install = (apply: (transaction: Transaction) => void) => {
      if (!session.resources.isActive()) {
        this.#options.record("late-callback", {
          route: name,
          reason: "driver",
        });

        return;
      }

      try {
        commit(apply);
      } catch {
        this.#recordFailure(name);
      }
    };

    return {
      scope: getScope(),
      running,
      emit: {
        observation: (draft: ObservationDraft<RouteBody>) =>
          install((transaction) =>
            record.installDraft(
              transaction,
              draft,
              this.#createEvidence(driver.name),
            ),
          ),
        prepared: (draft: PreparedDraft<RouteBody>) => {
          // A provider that said it prepares nothing has broken its own declaration.
          if (!driver.prepares) {
            this.#recordFailure(name);

            return;
          }

          install((transaction) => record.installPrepared(transaction, draft));
        },
        progress: (fraction: number | null) =>
          install((transaction) =>
            record.installProgress(transaction, fraction),
          ),
      },
    };
  }
}

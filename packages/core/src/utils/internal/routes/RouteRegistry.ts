import type { DriverContext } from "src/types/DriverContext";
import type { DriverSession } from "src/types/DriverSession";
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { DriverEntry } from "src/types/internal/DriverEntry";
import type { ErasedDriver } from "src/types/internal/ErasedDriver";
import type { ErasedPolicy } from "src/types/internal/ErasedPolicy";
import type { FeedEntry } from "src/types/internal/FeedEntry";
import type { ReadResult } from "src/types/internal/ReadResult";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { RouteRegistryOptions } from "src/types/internal/RouteRegistryOptions";
import type { Session } from "src/types/internal/Session";
import type { SharedReadErrors } from "src/types/internal/SharedReadErrors";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { MechanismSession } from "src/types/MechanismSession";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { PreparedDraft } from "src/types/PreparedDraft";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { RouteBody } from "src/types/RouteBody";
import type { RouteDefinition } from "src/types/RouteDefinition";
import { BeaconError } from "src/utils/BeaconError";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import { createEvidence } from "src/utils/internal/feeds/createEvidence";
import { FeedRecord } from "src/utils/internal/feeds/FeedRecord";
import { commitChange } from "src/utils/internal/observable/commitChange";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { SharedRead } from "src/utils/internal/reads/SharedRead";
import { claimExclusive } from "src/utils/internal/routes/claimExclusive";
import { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";
import { PolicyRecord } from "src/utils/internal/policy/PolicyRecord";
import { RouteRecord } from "src/utils/internal/routes/RouteRecord";

type CheckOptions = {
  mode: "join" | "after-current";
  signal: AbortSignal | undefined;
};

/** A selection or an evaluation that failed after its read was accepted, and the attempt it belongs to. */
type Failure = { attempt: number; error: BeaconError };

/**
 * Owns every route: its published state, the source it reads or the driver it
 * asks, and how a change reaches all of them in one commit. A source shared by
 * several routes is read once, and its one accepted document is selected
 * against for each of them together.
 */
export class RouteRegistry {
  #options: RouteRegistryOptions;
  #ledger = new ReferenceLedger();
  #entries = new Map<string, RouteEntry>();
  #feeds = new Map<ReleaseSource<unknown>, FeedEntry>();
  #feedOf = new Map<string, FeedEntry>();
  #drivers = new Map<string, DriverEntry>();
  #failures = new Map<string, Failure>();
  #policy: PolicyRecord;
  #policyFeed: FeedEntry | null = null;
  #policyFailure: Failure | null = null;

  constructor(options: RouteRegistryOptions) {
    this.#options = options;

    for (const [name, definition] of Object.entries(options.definitions)) {
      const record = new RouteRecord({
        name,
        prepares: this.#prepares(definition),
        ledger: this.#ledger,
        clock: options.clock,
        listeners: options.createListeners(),
      });

      const entry: RouteEntry = { name, definition, record };

      this.#entries.set(name, entry);

      if (definition.kind === "feed") {
        this.#addFeedRoute(entry, definition.source);
      } else if (definition.kind === "driver") {
        this.#addDriverRoute(entry, definition.driver);
      } else {
        assertUnreachable(definition);
      }
    }

    this.#policy = new PolicyRecord({
      policy: options.policy,
      listeners: options.createListeners(),
      getRoute: (name) => this.#entries.get(name)?.record.state.get(),
      onFailure: (error) =>
        options.record("policy-failed", { reason: error.code }),
    });

    this.#policyFeed = this.#addPolicyFeed(options.policy);
  }

  /** The references this Beacon has minted, for the commands that take them back. */
  getLedger = () => this.#ledger;

  getEntry = (name: string) => this.#entries.get(name);

  getEntries = () => [...this.#entries.values()];

  /** Opens what every route owns for the session: its mechanism or driver, and the expiry of a document held from before. */
  open = (session: Session) => {
    for (const entry of this.#entries.values()) {
      const { definition } = entry;

      if (definition.kind === "feed") {
        this.#openMechanism(entry, definition.mechanism, session);
      } else if (definition.kind === "driver") {
        this.#openDriver(entry, definition.driver, session);
      } else {
        assertUnreachable(definition);
      }
    }

    for (const feed of this.#feeds.values()) {
      feed.record.resume(session);
    }
  };

  /** Checks one route: joins the read of its source or driver, and answers how this caller's check settled. */
  check = async (
    session: Session,
    name: string,
    options: CheckOptions,
  ): Promise<CheckOutcome> => {
    const feed = this.#feedOf.get(name);

    if (feed !== undefined) {
      return this.#toOutcome(
        await feed.record.read(session, options),
        this.#failures.get(name),
      );
    }

    const driver = this.#drivers.get(name);

    if (driver === undefined) {
      throw new BeaconError({
        code: "INVALID_CONFIGURATION",
        message: `The route "${name}" is not defined.`,
      });
    }

    return this.#toOutcome(await driver.read.read(session, options), undefined);
  };

  /** What is known about support, which is unknown until a policy is accepted. */
  getSupport = () => this.#policy.state;

  hasPolicy = () => this.#policyFeed !== null;

  /** Checks the support policy's source, joining any read of it already under way; `null` without a policy. */
  checkPolicy = async (
    session: Session,
    options: CheckOptions,
  ): Promise<CheckOutcome | null> => {
    if (this.#policyFeed === null) {
      return null;
    }

    const result = await this.#policyFeed.record.read(session, options);

    return this.#toOutcome(result, this.#policyFailure);
  };

  /** Selects again from every document held, since what is running decides what is on offer. */
  handleRunningChange = () => {
    for (const feed of this.#feeds.values()) {
      const accepted = feed.record.getAccepted();

      if (accepted === null) {
        continue;
      }

      this.#commit((transaction) => this.#consume(transaction, feed, accepted));
    }
  };

  close = () => {
    for (const entry of this.#entries.values()) {
      entry.record.close();
    }

    this.#policy.close();
  };

  #prepares(definition: RouteDefinition) {
    if (definition.kind === "feed") {
      return false;
    }

    if (definition.kind === "driver") {
      return definition.driver.prepares;
    }

    return assertUnreachable(definition);
  }

  #addFeedRoute(entry: RouteEntry, source: ReleaseSource<unknown>) {
    const feed = this.#getFeed(source);

    feed.consumers.push(entry);
    this.#feedOf.set(entry.name, feed);
  }

  #addPolicyFeed(policy: ErasedPolicy | null) {
    if (policy === null) {
      return null;
    }

    return this.#getFeed(policy.source.source);
  }

  // Every consumer of a source, routes and the support policy alike, shares its one feed.
  #getFeed(source: ReleaseSource<unknown>) {
    const held = this.#feeds.get(source);

    if (held !== undefined) {
      return held;
    }

    const { clock, timeout, getScope, record } = this.#options;

    const feed: FeedEntry = {
      consumers: [],
      record: new FeedRecord({
        source,
        clock,
        timeout,
        getScope,
        hooks: {
          started: (attempt) =>
            this.#commit((transaction) => {
              for (const consumer of feed.consumers) {
                consumer.record.beginCheck(transaction, attempt);
              }
            }),
          accepted: (accepted) =>
            this.#commit((transaction) =>
              this.#consume(transaction, feed, accepted),
            ),
          failed: (attempt, error) =>
            this.#commit((transaction) => {
              for (const consumer of feed.consumers) {
                consumer.record.settleCheck(transaction, attempt, error);
              }
            }),
          record,
        },
      }),
    };

    this.#feeds.set(source, feed);

    return feed;
  }

  // The support policy reads routes to say which remediation is usable, so it follows every change of one.
  #commit(apply: (transaction: Transaction) => void) {
    commitChange((transaction) => {
      apply(transaction);
      this.#updatePolicy(transaction);
    });
  }

  #updatePolicy(transaction: Transaction) {
    if (this.#policyFeed === null) {
      return;
    }

    const accepted = this.#policyFeed.record.getAccepted();

    this.#policy.update(transaction, accepted, this.#options.running.get());

    if (accepted === null) {
      return;
    }

    const error = this.#policy.getFailure();

    this.#policyFailure =
      error === null ? null : { attempt: accepted.attempt, error };
  }

  // A selection that throws fails only its own route's check; the observation it held stays.
  #consume(transaction: Transaction, feed: FeedEntry, accepted: AcceptedFeed) {
    for (const consumer of feed.consumers) {
      const { definition, record, name } = consumer;

      if (definition.kind !== "feed") {
        continue;
      }

      try {
        const selection = definition.select(
          accepted.document,
          this.#options.running.get(),
        );

        record.installSelection(transaction, selection, accepted.evidence);
        record.settleCheck(transaction, accepted.attempt, null);
        this.#failures.delete(name);
      } catch (cause) {
        const error = toBeaconError(cause, {
          code: "SELECTION_FAILED",
          message: "A release could not be selected.",
        });

        this.#failures.set(name, { attempt: accepted.attempt, error });
        record.settleCheck(transaction, accepted.attempt, error);
        this.#options.record("route-failed", {
          route: name,
          reason: error.code,
        });
      }
    }
  }

  #addDriverRoute(entry: RouteEntry, driver: ErasedDriver) {
    const { clock, timeout, record } = this.#options;

    const failure: SharedReadErrors["failed"] = {
      code: "DRIVER_FAILED",
      message: "A provider could not be checked.",
    };

    const driverEntry: DriverEntry = {
      route: entry,
      session: null,
      read: new SharedRead<
        ObservationDraft<RouteBody>,
        ObservationDraft<RouteBody>
      >({
        clock,
        timeout,
        perform: ({ signal }) => this.#askDriver(driverEntry, signal),
        accept: (_attempt, draft) => draft,
        hooks: {
          started: (attempt) =>
            this.#commit((transaction) =>
              entry.record.beginCheck(transaction, attempt),
            ),
          accepted: (attempt, draft) =>
            this.#commit((transaction) => {
              entry.record.installDraft(
                transaction,
                draft,
                this.#createProviderEvidence(driver.name),
              );
              entry.record.settleCheck(transaction, attempt, null);
            }),
          failed: (attempt, error) =>
            this.#commit((transaction) =>
              entry.record.settleCheck(transaction, attempt, error),
            ),
          record,
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

    this.#drivers.set(entry.name, driverEntry);
  }

  #askDriver(driver: DriverEntry, signal: AbortSignal) {
    if (driver.session === null) {
      throw new BeaconError({
        code: "DRIVER_FAILED",
        message: "The provider is not open.",
      });
    }

    return driver.session.check({ signal });
  }

  #createProviderEvidence(source: string) {
    return createEvidence({
      source,
      origin: "provider",
      receivedAt: this.#options.clock.now(),
      expiresAt: null,
      issuer: null,
      revision: null,
    });
  }

  #openMechanism(
    entry: RouteEntry,
    mechanism: { open(): MechanismSession<object> },
    session: Session,
  ) {
    let opened: MechanismSession<object>;

    try {
      opened = mechanism.open();
    } catch {
      this.#options.record("route-failed", {
        route: entry.name,
        reason: "DRIVER_FAILED",
      });

      return;
    }

    this.#commit((transaction) =>
      entry.record.installNative(transaction, opened.native),
    );

    session.scope.add(() => {
      this.#commit((transaction) =>
        entry.record.installNative(transaction, null),
      );
      opened.dispose?.();
    });
  }

  #openDriver(entry: RouteEntry, driver: ErasedDriver, session: Session) {
    const driverEntry = this.#drivers.get(entry.name);

    if (driverEntry === undefined) {
      return;
    }

    const release = this.#claimManager(entry, driver);

    if (release === null) {
      return;
    }

    let opened: DriverSession<object, RouteBody>;

    try {
      opened = driver.open(this.#createDriverContext(entry, driver, session));
    } catch {
      release();
      this.#options.record("route-failed", {
        route: entry.name,
        reason: "DRIVER_FAILED",
      });

      return;
    }

    driverEntry.session = opened;

    this.#commit((transaction) =>
      entry.record.installNative(transaction, opened.native),
    );

    const controller = new AbortController();

    session.scope.add(() => {
      controller.abort();
      driverEntry.session = null;
      this.#commit((transaction) =>
        entry.record.installNative(transaction, null),
      );
      opened.dispose?.();
      release();
    });

    this.#reconcile(entry, opened, controller.signal);
  }

  // A manager one session holds is never opened by another: the route fails to open instead of racing for it.
  #claimManager(entry: RouteEntry, driver: ErasedDriver) {
    if (driver.exclusive === undefined) {
      return () => {};
    }

    const release = claimExclusive(driver.exclusive);

    if (release === null) {
      this.#options.record("route-failed", {
        route: entry.name,
        reason: "DRIVER_FAILED",
      });
    }

    return release;
  }

  // Reads the provider's current local state, as it stands after a restart; a failure is contained.
  #reconcile(
    entry: RouteEntry,
    opened: DriverSession<object, RouteBody>,
    signal: AbortSignal,
  ) {
    if (opened.reconcile === undefined) {
      return;
    }

    const reconciled = opened.reconcile({ signal });

    new Promise<void>((resolve) => resolve(reconciled)).catch(() => {
      this.#options.record("route-failed", {
        route: entry.name,
        reason: "DRIVER_FAILED",
      });
    });
  }

  #createDriverContext(
    entry: RouteEntry,
    driver: ErasedDriver,
    session: Session,
  ): DriverContext<RouteBody, RouteBody> {
    const { record, getScope, running } = this.#options;

    // A report from a session that ended is counted and dropped.
    const install = (apply: (transaction: Transaction) => void) => {
      if (!session.scope.isActive()) {
        record("late-callback", { route: entry.name, reason: "driver" });

        return;
      }

      this.#commit(apply);
    };

    return {
      scope: getScope(),
      running,
      emit: {
        observation: (draft: ObservationDraft<RouteBody>) =>
          install((transaction) =>
            entry.record.installDraft(
              transaction,
              draft,
              this.#createProviderEvidence(driver.name),
            ),
          ),
        prepared: (draft: PreparedDraft<RouteBody>) =>
          install((transaction) =>
            entry.record.installPrepared(transaction, draft),
          ),
        progress: (fraction: number | null) =>
          install((transaction) =>
            entry.record.installProgress(transaction, fraction),
          ),
      },
    };
  }

  #toOutcome(
    result: ReadResult,
    failure: Failure | undefined | null,
  ): CheckOutcome {
    if (result.status === "cancelled") {
      return { status: "cancelled" };
    }

    if (result.status === "superseded") {
      return { status: "superseded" };
    }

    if (result.status === "failed") {
      return {
        status: "failed",
        attempt: result.attempt,
        error: toErrorInfo(result.error),
      };
    }

    if (result.status === "accepted") {
      return this.#toAcceptedOutcome(result.attempt, failure);
    }

    return assertUnreachable(result);
  }

  // An accepted answer can still fail this route's selection, or the policy's evaluation, which only they know.
  #toAcceptedOutcome(
    attempt: number,
    failure: Failure | undefined | null,
  ): CheckOutcome {
    if (
      failure === undefined ||
      failure === null ||
      failure.attempt !== attempt
    ) {
      return { status: "succeeded", attempt };
    }

    return { status: "failed", attempt, error: toErrorInfo(failure.error) };
  }
}

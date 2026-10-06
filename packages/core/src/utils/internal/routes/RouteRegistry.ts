import type { CheckFailure } from "src/types/internal/CheckFailure";
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { FeedEntry } from "src/types/internal/FeedEntry";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { RouteRegistryOptions } from "src/types/internal/RouteRegistryOptions";
import type { Session } from "src/types/internal/Session";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RunningApplication } from "src/types/RunningApplication";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { commitChange } from "src/utils/internal/observable/commitChange";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { DriverRoutes } from "src/utils/internal/routes/DriverRoutes";
import { FeedRoutes } from "src/utils/internal/routes/FeedRoutes";
import { PolicyRecord } from "src/utils/internal/policy/PolicyRecord";
import { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";
import { RouteRecord } from "src/utils/internal/routes/RouteRecord";
import { toCheckOutcome } from "src/utils/internal/routes/toCheckOutcome";

/**
 * Owns every route and the support policy read from them: their published
 * state, and how a change reaches all of them in one commit. What differs by
 * kind of route lives with the kind.
 */
export class RouteRegistry {
  #ledger = new ReferenceLedger();
  #entries = new Map<string, RouteEntry>();
  #running: ObservableValue<RunningApplication>;
  #feeds: FeedRoutes;
  #drivers: DriverRoutes;
  #policy: PolicyRecord;
  #policyFeed: FeedEntry | null;
  #policyFailure: CheckFailure | null = null;

  constructor(options: RouteRegistryOptions) {
    this.#running = options.running;

    const group = {
      clock: options.clock,
      timeout: options.timeout,
      getScope: options.getScope,
      running: options.running,
      commit: (apply: (transaction: Transaction) => void) =>
        this.#commit(apply),
      record: options.record,
    };

    this.#feeds = new FeedRoutes(group);
    this.#drivers = new DriverRoutes(group);

    for (const [name, definition] of Object.entries(options.definitions)) {
      this.#entries.set(name, this.#createEntry(name, definition, options));
    }

    this.#policy = new PolicyRecord({
      policy: options.policy,
      listeners: options.createListeners(),
      getRoute: (name) => this.#entries.get(name)?.record.state.get(),
      onFailure: (error, cause) =>
        options.record("policy-failed", { reason: error.code, cause }),
      now: () => options.clock.now(),
    });

    // The policy shares the feed of its source with every route that reads it.
    this.#policyFeed =
      options.policy === null
        ? null
        : this.#feeds.getFeed(options.policy.source.source);
  }

  /** The references this Beacon has minted, for the commands that take them back. */
  getLedger = () => this.#ledger;

  getEntries = () => [...this.#entries.values()];

  /** Opens what every route owns for the session: its mechanism or driver, and the expiry of a document held from before. */
  open = (session: Session) => {
    for (const { runtime } of this.#entries.values()) {
      // A listener told that a route opened may have ended the session: nothing else is opened for it.
      if (!session.resources.isActive()) {
        return;
      }

      runtime.open(session);
    }

    if (!session.resources.isActive()) {
      return;
    }

    this.#feeds.resume(session);
  };

  /** What is known about support, which is unknown until a policy is accepted. */
  getSupport = () => this.#policy.state;

  hasPolicy = () => this.#policyFeed !== null;

  /** Checks the support policy's source, joining any read of it already under way; `null` without a policy. */
  checkPolicy = async (
    session: Session,
    options: ReadOptions,
  ): Promise<CheckOutcome | null> => {
    if (this.#policyFeed === null) {
      return null;
    }

    return toCheckOutcome(
      await this.#policyFeed.record.read(session, options),
      this.#policyFailure,
    );
  };

  /** Selects again from every document held, since what is running decides what is on offer; every route changes in one commit. */
  reselect = () => {
    this.#commit((transaction) => this.#feeds.reselect(transaction));
  };

  /**
   * Forgets what the scope that ended taught: every document held, what each
   * route observed and prepared and the support evaluated from them. The routes, their mechanisms and the running facts stay.
   */
  reset = () => {
    this.#feeds.reset();
    this.#policyFailure = null;

    this.#commit((transaction) => {
      for (const { record } of this.#entries.values()) {
        record.reset(transaction);
      }

      this.#policy.reset(transaction);
    });
  };

  close = () => {
    for (const { record } of this.#entries.values()) {
      record.close();
    }

    this.#policy.close();
  };

  #createEntry(
    name: string,
    definition: RouteDefinition,
    { clock, createListeners }: RouteRegistryOptions,
  ): RouteEntry {
    const create = (prepares: boolean) =>
      new RouteRecord({
        name,
        prepares,
        ledger: this.#ledger,
        clock,
        createListeners,
      });

    if (definition.kind === "feed") {
      const record = create(false);
      const runtime = this.#feeds.add({ name, record, definition });

      return {
        name,
        subject: definition.mechanism.subject,
        commands: definition.mechanism.commands,
        record,
        runtime,
      };
    }

    if (definition.kind === "driver") {
      const record = create(definition.driver.prepares);

      const runtime = this.#drivers.add({
        name,
        record,
        driver: definition.driver,
      });

      return {
        name,
        subject: definition.driver.subject,
        commands: definition.driver.commands,
        record,
        runtime,
      };
    }

    return assertUnreachable(definition);
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

    this.#policy.update(
      transaction,
      accepted,
      this.#running.get(),
      this.#policyFeed.record.getFailure(),
    );

    if (accepted === null) {
      return;
    }

    const error = this.#policy.getFailure();

    this.#policyFailure =
      error === null ? null : { attempt: accepted.attempt, error };
  }
}

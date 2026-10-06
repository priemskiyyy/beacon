import type { CheckFailure } from "src/types/internal/CheckFailure";
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { FeedEntry } from "src/types/internal/FeedEntry";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { RouteRegistryOptions } from "src/types/internal/RouteRegistryOptions";
import type { RouteRuntime } from "src/types/internal/RouteRuntime";
import type { Session } from "src/types/internal/Session";
import type { RouteDefinition } from "src/types/RouteDefinition";
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
  #options: RouteRegistryOptions;
  #ledger = new ReferenceLedger();
  #entries = new Map<string, RouteEntry>();
  #feeds: FeedRoutes;
  #drivers: DriverRoutes;
  #policy: PolicyRecord;
  #policyFeed: FeedEntry | null;
  #policyFailure: CheckFailure | null = null;

  constructor(options: RouteRegistryOptions) {
    this.#options = options;

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
      const record = new RouteRecord({
        name,
        prepares: this.#prepares(definition),
        ledger: this.#ledger,
        clock: options.clock,
        createListeners: options.createListeners,
      });

      this.#entries.set(name, {
        name,
        definition,
        record,
        runtime: this.#createRuntime(name, record, definition),
      });
    }

    this.#policy = new PolicyRecord({
      policy: options.policy,
      listeners: options.createListeners(),
      getRoute: (name) => this.#entries.get(name)?.record.state.get(),
      onFailure: (error) =>
        options.record("policy-failed", { reason: error.code }),
      now: () => options.clock.now(),
    });

    this.#policyFeed = this.#createPolicyFeed();
  }

  /** The references this Beacon has minted, for the commands that take them back. */
  getLedger = () => this.#ledger;

  getEntries = () => [...this.#entries.values()];

  /** Opens what every route owns for the session: its mechanism or driver, and the expiry of a document held from before. */
  open = (session: Session) => {
    for (const { runtime } of this.#entries.values()) {
      runtime.open(session);
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
  handleRunningChange = () => {
    this.#commit((transaction) => this.#feeds.reselect(transaction));
  };

  /**
   * Forgets what the scope that ended taught: every document held, what each
   * route observed and prepared and the support evaluated from them. The routes, their mechanisms and the running facts stay.
   */
  reset = () => {
    this.#feeds.reset();

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

  #prepares(definition: RouteDefinition) {
    if (definition.kind === "feed") {
      return false;
    }

    if (definition.kind === "driver") {
      return definition.driver.prepares;
    }

    return assertUnreachable(definition);
  }

  #createRuntime(
    name: string,
    record: RouteRecord,
    definition: RouteDefinition,
  ): RouteRuntime {
    if (definition.kind === "feed") {
      return this.#feeds.add({ name, record, definition });
    }

    if (definition.kind === "driver") {
      return this.#drivers.add({ name, record, driver: definition.driver });
    }

    return assertUnreachable(definition);
  }

  #createPolicyFeed() {
    const { policy } = this.#options;

    if (policy === null) {
      return null;
    }

    return this.#feeds.getFeed(policy.source.source);
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
}

import type { CheckFailure } from "src/types/internal/CheckFailure";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { FeedConsumer } from "src/types/internal/FeedConsumer";
import type { FeedEntry } from "src/types/internal/FeedEntry";
import type { RouteGroupOptions } from "src/types/internal/RouteGroupOptions";
import type { RouteRuntime } from "src/types/internal/RouteRuntime";
import type { Session } from "src/types/internal/Session";
import type { MechanismSession } from "src/types/MechanismSession";
import type { ReleaseSource } from "src/types/ReleaseSource";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { FeedRecord } from "src/utils/internal/feeds/FeedRecord";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { toCheckOutcome } from "src/utils/internal/routes/toCheckOutcome";

/**
 * Owns the routes that take offers from a release source. A source shared by
 * several routes, or by the support policy, is read once, and its one accepted
 * document is selected against for each of them together.
 */
export class FeedRoutes {
  #options: RouteGroupOptions;
  #feeds = new Map<ReleaseSource<unknown>, FeedEntry>();
  #failures = new Map<string, CheckFailure>();

  constructor(options: RouteGroupOptions) {
    this.#options = options;
  }

  /** Joins a route to the feed of its source, and answers how it opens and is checked. */
  add = (consumer: FeedConsumer): RouteRuntime => {
    const feed = this.getFeed(consumer.definition.source);

    feed.consumers.push(consumer);

    return {
      dependsOn: [consumer.definition.subject],
      open: (session) => this.#openMechanism(consumer, session),
      check: async (session, options) =>
        toCheckOutcome(
          await feed.record.read(session, options),
          this.#failures.get(consumer.name) ?? null,
        ),
    };
  };

  // Every consumer of a source, routes and the support policy alike, shares its one feed.
  getFeed = (source: ReleaseSource<unknown>) => {
    const held = this.#feeds.get(source);

    if (held !== undefined) {
      return held;
    }

    const { clock, timeout, getScope, commit } = this.#options;

    const feed: FeedEntry = {
      consumers: [],
      record: new FeedRecord({
        source,
        clock,
        timeout,
        getScope,
        hooks: {
          started: (attempt) =>
            commit((transaction) => {
              for (const consumer of feed.consumers) {
                consumer.record.beginCheck(transaction, attempt);
              }
            }),
          accepted: (accepted) =>
            commit((transaction) => this.#consume(transaction, feed, accepted)),
          failed: (attempt, error) =>
            commit((transaction) => {
              for (const consumer of feed.consumers) {
                consumer.record.settleCheck(transaction, attempt, error);
              }
            }),
          record: this.#options.record,
        },
      }),
    };

    this.#feeds.set(source, feed);

    return feed;
  };

  /** Arms the expiry of every document held from an earlier session. */
  resume = (session: Session) => {
    for (const feed of this.#feeds.values()) {
      feed.record.resume(session);
    }
  };

  /** Selects again from every document held, since what is running decides what is on offer. */
  reselect = (transaction: Transaction) => {
    for (const feed of this.#feeds.values()) {
      const accepted = feed.record.getAccepted();

      if (accepted === null) {
        continue;
      }

      this.#consume(transaction, feed, accepted);
    }
  };

  /** Forgets every document held, and the selections that failed from them. */
  reset = () => {
    for (const feed of this.#feeds.values()) {
      feed.record.reset();
    }

    this.#failures.clear();
  };

  // A selection that throws fails only its own route's check; the observation it held stays.
  #consume(transaction: Transaction, feed: FeedEntry, accepted: AcceptedFeed) {
    const { running } = this.#options;

    for (const consumer of feed.consumers) {
      const { definition, name } = consumer;

      try {
        const selection = definition.select(accepted.document, running.get());

        consumer.record.installSelection(
          transaction,
          selection,
          accepted.evidence,
        );
        consumer.record.settleCheck(transaction, accepted.attempt, null);
        this.#failures.delete(name);
      } catch (cause) {
        const error = toBeaconError(cause, {
          code: "SELECTION_FAILED",
          message: "A release could not be selected.",
        });

        this.#failures.set(name, { attempt: accepted.attempt, error });
        consumer.record.settleCheck(transaction, accepted.attempt, error);
        this.#options.record("route-failed", {
          route: name,
          reason: error.code,
        });
      }
    }
  }

  #openMechanism({ name, definition, record }: FeedConsumer, session: Session) {
    let opened: MechanismSession<object>;

    try {
      opened = definition.mechanism.open();
    } catch {
      this.#options.record("route-failed", {
        route: name,
        reason: "DRIVER_FAILED",
      });

      return;
    }

    const { commit } = this.#options;

    commit((transaction) => record.installNative(transaction, opened.native));

    session.resources.add(() => {
      commit((transaction) => record.installNative(transaction, null));
      opened.dispose?.();
    });
  }
}

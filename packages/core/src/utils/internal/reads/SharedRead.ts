import type { ReadFlight } from "src/types/internal/ReadFlight";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { ReadResult } from "src/types/internal/ReadResult";
import type {
  ReadWaiter,
  ReadWaiterGroup,
} from "src/types/internal/ReadWaiter";
import type { Session } from "src/types/internal/Session";
import type { SharedReadOptions } from "src/types/internal/SharedReadOptions";
import { BeaconError } from "src/utils/BeaconError";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";

/**
 * One question asked of one authority at a time, however many callers want the
 * answer. Callers join the read in flight, or ask for one trailing read after
 * it; a caller's abort ends that caller's wait alone, and only when nobody is
 * left is the read aborted. A read answers only the session that started it.
 */
export class SharedRead<TAnswer, TAccepted> {
  #options: SharedReadOptions<TAnswer, TAccepted>;
  #attempts = 0;
  #flight: ReadFlight | null = null;
  #trailing: ReadWaiterGroup | null = null;
  #calls = new WeakMap<ReadOptions, ReadWaiterGroup>();

  constructor(options: SharedReadOptions<TAnswer, TAccepted>) {
    this.#options = options;
  }

  /** Reads, or joins the read in flight; resolves when this caller's read settled, and never rejects. */
  read = (session: Session, options: ReadOptions) =>
    new Promise<ReadResult>((resolve) => {
      const { signal } = options;

      if (!session.resources.isActive()) {
        resolve({ status: "superseded" });

        return;
      }

      if (signal !== undefined && signal.aborted) {
        resolve({ status: "cancelled" });

        return;
      }

      const { group, isNew } = this.#chooseGroup(options);

      let detach = () => {};

      const waiter: ReadWaiter = {
        group,
        settle: (result) => {
          detach();
          resolve(result);
        },
      };

      group.waiters.add(waiter);

      if (signal !== undefined) {
        const handleAbort = () => this.#leave(waiter);

        signal.addEventListener("abort", handleAbort, { once: true });
        detach = () => signal.removeEventListener("abort", handleAbort);
      }

      if (!isNew) {
        return;
      }

      this.#startFlight(session, group);
    });

  // What one call asked of this authority, it asks once: a read that the call itself started is not one to ask again after.
  #chooseGroup(options: ReadOptions) {
    const own = this.#calls.get(options);

    if (own !== undefined && this.#isWaiting(own)) {
      return { group: own, isNew: false };
    }

    const chosen = this.#pickGroup(options.mode);

    this.#calls.set(options, chosen.group);

    return chosen;
  }

  #pickGroup(mode: ReadOptions["mode"]) {
    const flight = this.#flight;

    if (flight === null) {
      return { group: { waiters: new Set<ReadWaiter>() }, isNew: true };
    }

    if (mode === "join") {
      return { group: flight.group, isNew: false };
    }

    if (this.#trailing === null) {
      this.#trailing = { waiters: new Set<ReadWaiter>() };
    }

    return { group: this.#trailing, isNew: false };
  }

  // A group is waiting while its read is in flight or is next.
  #isWaiting(group: ReadWaiterGroup) {
    return this.#flight?.group === group || this.#trailing === group;
  }

  #startFlight(session: Session, group: ReadWaiterGroup) {
    const { clock, timeout, perform, hooks, errors } = this.#options;

    this.#attempts += 1;

    const flight: ReadFlight = {
      attempt: this.#attempts,
      session,
      controller: new AbortController(),
      group,
      finished: false,
      stops: [],
    };

    this.#flight = flight;

    flight.stops.push(session.resources.add(() => this.#end(flight)));

    hooks.record("read-started", { attempt: flight.attempt });
    hooks.started(flight.attempt);

    // A listener told about the start may have ended the session.
    if (flight.finished) {
      return;
    }

    // The host's clock can refuse a timer, and a read with no deadline is never started: it fails, as one that ran out of time does.
    try {
      flight.stops.push(
        clock.setTimer(() => {
          flight.controller.abort();
          this.#fail(flight, new BeaconError(errors.timeout));
        }, timeout),
      );
    } catch (cause) {
      this.#fail(flight, toBeaconError(cause, errors.failed));

      return;
    }

    new Promise<TAnswer>((resolve) => {
      resolve(
        perform({ attempt: flight.attempt, signal: flight.controller.signal }),
      );
    }).then(
      (answer) => this.#takeAnswer(flight, answer),
      (cause) => this.#fail(flight, toBeaconError(cause, errors.failed)),
    );
  }

  #takeAnswer(flight: ReadFlight, answer: TAnswer) {
    const { accept, hooks, errors } = this.#options;

    if (flight.finished) {
      hooks.record("late-callback", { reason: "read" });

      return;
    }

    let accepted: TAccepted;

    try {
      accepted = accept(flight.attempt, answer);
    } catch (cause) {
      this.#fail(flight, toBeaconError(cause, errors.invalid));

      return;
    }

    this.#finish(flight);

    // A hook that throws leaves nobody waiting forever: the read fails, and the next one still runs.
    try {
      hooks.accepted(flight.attempt, accepted, flight.session);
    } catch (cause) {
      this.#settleFailure(flight, toBeaconError(cause, errors.invalid));

      return;
    }

    this.#settle(flight.group, { status: "accepted", attempt: flight.attempt });
    this.#startTrailing(flight.session);
  }

  #fail(flight: ReadFlight, error: BeaconError) {
    const { hooks } = this.#options;

    if (flight.finished) {
      hooks.record("late-callback", { reason: "read" });

      return;
    }

    this.#finish(flight);
    this.#settleFailure(flight, error);
  }

  #settleFailure(flight: ReadFlight, error: BeaconError) {
    const { hooks } = this.#options;

    hooks.record("read-failed", {
      attempt: flight.attempt,
      reason: error.code,
    });

    // Whatever the owner does with the failure, everyone who waited is told and the next read goes on.
    try {
      hooks.failed(flight.attempt, error);
    } finally {
      this.#settle(flight.group, {
        status: "failed",
        attempt: flight.attempt,
        error,
      });
      this.#startTrailing(flight.session);
    }
  }

  #finish(flight: ReadFlight) {
    flight.finished = true;
    this.#flight = null;

    for (const stop of flight.stops) {
      stop();
    }
  }

  #settle(group: ReadWaiterGroup, result: ReadResult) {
    const waiters = [...group.waiters];

    group.waiters.clear();

    for (const waiter of waiters) {
      waiter.settle(result);
    }
  }

  // The session ended under the read: it is aborted, and everyone who waited for it or after it is told.
  #end(flight: ReadFlight) {
    if (flight.finished) {
      return;
    }

    flight.controller.abort();
    this.#finish(flight);

    try {
      this.#options.hooks.failed(
        flight.attempt,
        new BeaconError({
          code: "ABORTED",
          message: "The session ended during the check.",
        }),
      );
    } finally {
      this.#settle(flight.group, { status: "superseded" });

      const trailing = this.#trailing;

      this.#trailing = null;

      if (trailing !== null) {
        this.#settle(trailing, { status: "superseded" });
      }
    }
  }

  #leave(waiter: ReadWaiter) {
    const { group } = waiter;

    group.waiters.delete(waiter);
    waiter.settle({ status: "cancelled" });

    if (group.waiters.size > 0) {
      return;
    }

    const flight = this.#flight;

    if (flight === null || flight.group !== group) {
      return;
    }

    this.#abandon(flight);
  }

  // Nobody waits for the read anymore, so it is aborted and its answer will be ignored.
  #abandon(flight: ReadFlight) {
    const { hooks } = this.#options;

    flight.controller.abort();
    this.#finish(flight);
    hooks.record("read-abandoned", { attempt: flight.attempt });

    try {
      hooks.failed(
        flight.attempt,
        new BeaconError({
          code: "ABORTED",
          message: "Every caller stopped waiting for the check.",
        }),
      );
    } finally {
      this.#startTrailing(flight.session);
    }
  }

  #startTrailing(session: Session) {
    const group = this.#trailing;

    if (group === null) {
      return;
    }

    this.#trailing = null;

    if (group.waiters.size === 0) {
      return;
    }

    if (!session.resources.isActive()) {
      this.#settle(group, { status: "superseded" });

      return;
    }

    this.#startFlight(session, group);
  }
}

import type { ReadFlight } from "src/types/internal/ReadFlight";
import type { ReadResult } from "src/types/internal/ReadResult";
import type {
  ReadWaiter,
  ReadWaiterGroup,
} from "src/types/internal/ReadWaiter";
import type { Session } from "src/types/internal/Session";
import type { SharedReadOptions } from "src/types/internal/SharedReadOptions";
import { BeaconError } from "src/utils/BeaconError";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";

type ReadOptions = {
  mode: "join" | "after-current";
  signal: AbortSignal | undefined;
};

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

  constructor(options: SharedReadOptions<TAnswer, TAccepted>) {
    this.#options = options;
  }

  /** Reads, or joins the read in flight; resolves when this caller's read settled, and never rejects. */
  read = (session: Session, { mode, signal }: ReadOptions) =>
    new Promise<ReadResult>((resolve) => {
      if (!session.scope.isActive()) {
        resolve({ status: "superseded" });

        return;
      }

      if (signal !== undefined && signal.aborted) {
        resolve({ status: "cancelled" });

        return;
      }

      const { group, isNew } = this.#chooseGroup(mode);

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

  #chooseGroup(mode: ReadOptions["mode"]) {
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

  #startFlight(session: Session, group: ReadWaiterGroup) {
    const { clock, timeout, perform, hooks, errors } = this.#options;

    this.#attempts += 1;

    const flight: ReadFlight = {
      attempt: this.#attempts,
      session,
      controller: new AbortController(),
      group,
      finished: false,
      release: () => {},
    };

    this.#flight = flight;

    const cancelTimeout = clock.setTimer(() => {
      flight.controller.abort();
      this.#fail(flight, new BeaconError(errors.timeout));
    }, timeout);

    const removeCleanup = session.scope.add(() => this.#end(flight));

    flight.release = () => {
      cancelTimeout();
      removeCleanup();
    };

    hooks.record("read-started", { attempt: flight.attempt });
    hooks.started(flight.attempt);

    // A listener told about the start may have ended the session.
    if (flight.finished) {
      return;
    }

    new Promise<TAnswer>((resolve) => {
      resolve(
        perform({ attempt: flight.attempt, signal: flight.controller.signal }),
      );
    }).then(
      (answer) => this.#handleAnswer(flight, answer),
      (cause) => this.#fail(flight, toBeaconError(cause, errors.failed)),
    );
  }

  #handleAnswer(flight: ReadFlight, answer: TAnswer) {
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
    hooks.failed(flight.attempt, error);
    this.#settle(flight.group, {
      status: "failed",
      attempt: flight.attempt,
      error,
    });
    this.#startTrailing(flight.session);
  }

  #finish(flight: ReadFlight) {
    flight.finished = true;
    flight.release();

    if (this.#flight !== flight) {
      return;
    }

    this.#flight = null;
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
    this.#options.hooks.failed(
      flight.attempt,
      new BeaconError({
        code: "ABORTED",
        message: "The session ended during the check.",
      }),
    );
    this.#settle(flight.group, { status: "superseded" });

    const trailing = this.#trailing;

    this.#trailing = null;

    if (trailing === null) {
      return;
    }

    this.#settle(trailing, { status: "superseded" });
  }

  #leave(waiter: ReadWaiter) {
    const { group } = waiter;

    if (!group.waiters.delete(waiter)) {
      return;
    }

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
    hooks.failed(
      flight.attempt,
      new BeaconError({
        code: "ABORTED",
        message: "Every caller stopped waiting for the check.",
      }),
    );
    this.#startTrailing(flight.session);
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

    if (!session.scope.isActive()) {
      this.#settle(group, { status: "superseded" });

      return;
    }

    this.#startFlight(session, group);
  }
}

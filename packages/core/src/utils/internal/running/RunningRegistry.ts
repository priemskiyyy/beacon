import type { BeaconClock } from "src/types/BeaconClock";
import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { DiagnosticDetails } from "src/types/internal/DiagnosticDetails";
import type { Session } from "src/types/internal/Session";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningFact } from "src/types/RunningFact";
import type { RunningReader } from "src/types/RunningReader";
import type { RunningReaders } from "src/types/RunningReaders";
import type { RunningRelease } from "src/types/RunningRelease";
import type { RunningSubject } from "src/types/RunningSubject";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";
import { BeaconError } from "src/utils/BeaconError";
import { createDeferred } from "src/utils/internal/common/createDeferred";
import { isSameData } from "src/utils/internal/common/isSameData";
import { mapNames } from "src/utils/internal/routes/mapRoutes";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import type { Listeners } from "src/utils/internal/observable/Listeners";
import { ValueStore } from "src/utils/internal/observable/ValueStore";
import { copyRunningRelease } from "src/utils/internal/running/copyRunningRelease";

type RunningRegistryOptions = {
  readers: RunningReaders;
  clock: BeaconClock;
  timeout: number;
  listeners: Listeners;
  record: (
    type: BeaconDiagnosticEventType,
    details?: DiagnosticDetails,
  ) => void;
};

type Reads = Record<RunningSubject, Promise<void>>;

// A subject with a reader is pending until the reader answers, and one
// without stays unconfigured.
const getInitialFact = (reader: RunningReader | undefined): RunningFact => {
  if (reader === undefined) {
    return Object.freeze({ state: "unconfigured" });
  }

  return Object.freeze({ state: "pending" });
};

// When a fact was read does not count: a re-read that says the same adds nothing.
const withoutReadTime = (fact: RunningFact) => {
  if (fact.state !== "known") {
    return fact;
  }

  return { ...fact, readAt: 0 };
};

/** Owns the executing facts: one local reader per subject, asked once for each session, and never written by a remote answer. */
export class RunningRegistry {
  #readers: RunningReaders;
  #clock: BeaconClock;
  #timeout: number;
  #store: ValueStore<RunningApplication>;
  #record: RunningRegistryOptions["record"];
  #sessionReads = new WeakMap<Session, Reads>();

  state: ObservableValue<RunningApplication>;

  constructor({
    readers,
    clock,
    timeout,
    listeners,
    record,
  }: RunningRegistryOptions) {
    this.#readers = Object.freeze({ ...readers });
    this.#clock = clock;
    this.#timeout = timeout;
    this.#record = record;
    this.#store = new ValueStore<RunningApplication>(
      Object.freeze({
        boot: Object.freeze({ id: readers.boot.id }),
        revision: 0,
        native: getInitialFact(readers.native),
        bundle: getInitialFact(readers.bundle),
        web: getInitialFact(readers.web),
        worker: getInitialFact(readers.worker),
      }),
      listeners,
    );
    this.state = this.#store.observable;
  }

  /**
   * Reads every configured subject for the session, once: asking again for
   * the same session answers the same reads. A subject's promise resolves once
   * it has answered, failed or timed out, or the session ended, and none
   * rejects.
   */
  read = (session: Session): Reads => {
    const held = this.#sessionReads.get(session);

    if (held !== undefined) {
      return held;
    }

    // Held before any reader runs, since a reader may ask for the reads of its own session.
    const gates = mapNames(RUNNING_SUBJECTS, () => createDeferred());

    const reads = mapNames(
      RUNNING_SUBJECTS,
      (subject) => gates[subject].promise,
    );

    this.#sessionReads.set(session, reads);

    for (const subject of RUNNING_SUBJECTS) {
      this.#readSubject(subject, session).then(gates[subject].resolve);
    }

    return reads;
  };

  close = () => {
    this.#store.close();
  };

  async #readSubject(subject: RunningSubject, session: Session) {
    const reader = this.#readers[subject];

    // An earlier reader may have ended this session, and no later one is asked for it.
    if (reader === undefined || !session.scope.isActive()) {
      return;
    }

    const fact = await this.#run(subject, reader, session);

    // The session ended its read; an answer that still comes is counted where it arrives.
    if (fact === null) {
      return;
    }

    if (!session.scope.isActive()) {
      this.#recordLate(subject);

      return;
    }

    this.#install(subject, fact);
  }

  // Never rejects: a throw, a rejection, an answer that is no release and a missed deadline are all a failed fact, and the end of the session is no fact at all.
  async #run(
    subject: RunningSubject,
    reader: RunningReader,
    session: Session,
  ): Promise<RunningFact | null> {
    let cancel = () => {};

    let release = () => {};

    const interrupted = new Promise<RunningFact | null>((resolve) => {
      cancel = this.#clock.setTimer(() => {
        resolve(
          this.#fail(
            new BeaconError({
              code: "RUNNING_READ_FAILED",
              message: "A running fact was not read in time.",
            }),
          ),
        );
      }, this.#timeout);

      release = session.scope.add(() => {
        cancel();
        resolve(null);
      });
    });

    const reading = new Promise<RunningRelease>((resolve) => resolve(reader()))
      .then((answer) => this.#know(answer))
      .catch((cause) => this.#fail(cause));

    // Only the application's clock can make the wait itself fail, by throwing when a timer is armed.
    const fact = await Promise.race([reading, interrupted]).catch((cause) =>
      this.#fail(cause),
    );

    cancel();
    release();

    if (fact === null) {
      reading.then(() => this.#recordLate(subject));
    }

    return fact;
  }

  #know(answer: RunningRelease): RunningFact {
    return Object.freeze({
      state: "known",
      release: copyRunningRelease(answer),
      readAt: this.#clock.now(),
    });
  }

  #fail(cause: unknown): RunningFact {
    const error = toBeaconError(cause, {
      code: "RUNNING_READ_FAILED",
      message: "A running fact could not be read.",
    });

    return Object.freeze({ state: "failed", error: toErrorInfo(error) });
  }

  #recordLate(subject: RunningSubject) {
    this.#record("late-callback", { reason: `running-${subject}` });
  }

  #install(subject: RunningSubject, next: RunningFact) {
    const held = this.#store.get();

    if (isSameData(withoutReadTime(held[subject]), withoutReadTime(next))) {
      return;
    }

    if (next.state === "failed") {
      this.#record("running-failed", { reason: subject });
    }

    if (next.state === "known") {
      this.#record("running-read", { reason: subject });
    }

    this.#store.update(
      Object.freeze({
        ...held,
        [subject]: next,
        revision: held.revision + 1,
      }),
    );
  }
}

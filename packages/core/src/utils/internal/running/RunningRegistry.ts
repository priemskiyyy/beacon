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
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import type { Listeners } from "src/utils/internal/observable/Listeners";
import { ValueStore } from "src/utils/internal/observable/ValueStore";
import { copyRunningRelease } from "src/utils/internal/running/copyRunningRelease";
import { isSameRunningFact } from "src/utils/internal/running/isSameRunningFact";

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

// A subject with a reader is pending until the reader answers, and one
// without stays unconfigured.
const getInitialFact = (reader: RunningReader | undefined): RunningFact => {
  if (reader === undefined) {
    return Object.freeze({ state: "unconfigured" });
  }

  return Object.freeze({ state: "pending" });
};

/** Owns the executing facts: one local reader per subject, read again on demand, never written by a remote answer. */
export class RunningRegistry {
  #readers: RunningReaders;
  #clock: BeaconClock;
  #timeout: number;
  #store: ValueStore<RunningApplication>;
  #record: RunningRegistryOptions["record"];
  #reads = new Map<RunningSubject, object>();

  state: ObservableValue<RunningApplication>;

  constructor({
    readers,
    clock,
    timeout,
    listeners,
    record,
  }: RunningRegistryOptions) {
    this.#readers = readers;
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

  /** Reads every configured subject again; resolves once each has answered, failed or timed out, and never rejects. */
  read = async (session: Session) => {
    await Promise.all(
      RUNNING_SUBJECTS.map((subject) => this.#readSubject(subject, session)),
    );
  };

  close = () => {
    this.#store.close();
  };

  async #readSubject(subject: RunningSubject, session: Session) {
    const reader = this.#readers[subject];

    if (reader === undefined) {
      return;
    }

    const read = {};

    this.#reads.set(subject, read);

    const fact = await this.#run(reader, session);

    if (!session.scope.isActive() || this.#reads.get(subject) !== read) {
      this.#record("late-callback", { reason: `running-${subject}` });

      return;
    }

    this.#install(subject, fact);
  }

  // Never rejects: a throw, a rejection and a missed deadline are all a failed fact.
  async #run(reader: RunningReader, session: Session): Promise<RunningFact> {
    let cancel = () => {};

    const expired = new Promise<never>((_resolve, reject) => {
      cancel = this.#clock.setTimer(() => {
        reject(
          new BeaconError({
            code: "RUNNING_READ_FAILED",
            message: "A running fact was not read in time.",
          }),
        );
      }, this.#timeout);
    });

    session.scope.add(cancel);

    try {
      const release = await Promise.race([
        new Promise<RunningRelease>((resolve) => resolve(reader())),
        expired,
      ]);

      return Object.freeze({
        state: "known",
        release: copyRunningRelease(release),
        readAt: this.#clock.now(),
      });
    } catch (cause) {
      const error = toBeaconError(cause, {
        code: "RUNNING_READ_FAILED",
        message: "A running fact could not be read.",
      });

      return Object.freeze({ state: "failed", error: toErrorInfo(error) });
    } finally {
      cancel();
    }
  }

  #install(subject: RunningSubject, next: RunningFact) {
    const held = this.#store.get();

    if (isSameRunningFact(held[subject], next)) {
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

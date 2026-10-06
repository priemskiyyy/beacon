import type { IntentDraft } from "src/types/internal/IntentDraft";
import type { JournalConfig } from "src/types/internal/JournalConfig";
import type { JournalWrite } from "src/types/internal/JournalWrite";
import type { ResolvedJournalOptions } from "src/types/internal/ResolvedJournalOptions";
import type { Session } from "src/types/internal/Session";
import type { StoredTransition } from "src/types/internal/StoredTransition";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReadyReport } from "src/types/ReadyReport";
import type { Reconciliation } from "src/types/Reconciliation";
import type { RunningApplication } from "src/types/RunningApplication";
import type { TransitionState } from "src/types/TransitionState";
import { BeaconError } from "src/utils/BeaconError";
import {
  DEFAULT_CHECKPOINT,
  JOURNAL_CAPACITY,
} from "src/utils/constants/journal";
import { createDeferred } from "src/utils/internal/common/createDeferred";
import { freezeList } from "src/utils/internal/common/freezeList";
import { isSameData } from "src/utils/internal/common/isSameData";
import { countAttempts } from "src/utils/internal/journal/countAttempts";
import { freezeIntent } from "src/utils/internal/journal/freezeIntent";
import { createJournalKey } from "src/utils/internal/journal/createJournalKey";
import { parseJournal } from "src/utils/internal/journal/parseJournal";
import { reconcileIntent } from "src/utils/internal/journal/reconcileIntent";
import { serializeJournal } from "src/utils/internal/journal/serializeJournal";
import { commitChange } from "src/utils/internal/observable/commitChange";
import { ValueStore } from "src/utils/internal/observable/ValueStore";

/**
 * Owns the transition journal: the intents written before a command replaces
 * the realm, what a later boot says about them, and the readiness checkpoints
 * of this boot. Every read and write goes through one queue, so a slow
 * hydration can never overwrite an intent written after it began, and a
 * hydration that arrives after its session ended is dropped. A call the
 * storage does not answer in time is given up on, so the queue never waits for
 * it. Without a configured journal it does nothing and says it is off.
 */
export class Journal {
  #config: JournalConfig;
  #generation = 0;
  #store: ValueStore<TransitionState>;
  #transitions: StoredTransition[] = [];
  #queue: Promise<void> = Promise.resolve();
  #hydrated = false;

  state: ObservableValue<TransitionState>;

  constructor(config: JournalConfig) {
    this.#config = config;

    this.#store = new ValueStore<TransitionState>(
      Object.freeze({
        revision: 0,
        journal: config.options === undefined ? "off" : "reading",
        latest: null,
        dropped: 0,
        checkpoints: freezeList([]),
      }),
      config.listeners,
    );
    this.state = this.#store.observable;
  }

  /** Reads the record once, and reconciles every intent of an earlier boot against what runs now. */
  hydrate = (session: Session) =>
    this.#enqueue(async (claim) => {
      const { options } = this.#config;

      if (options === undefined || this.#hydrated) {
        return;
      }

      const read = await this.#read(options, claim.key);
      const running = await this.#config.getRunning(session);

      // A read that arrives after its session or its scope ended describes nothing that is still true.
      if (
        !session.resources.isActive() ||
        claim.generation !== this.#generation
      ) {
        return;
      }

      this.#hydrated = read !== undefined;
      await this.#reconcile(options, read, running, claim.key);
    });

  /** Persists an intent before its command is dispatched, and answers whether the command may go on. */
  write = (draft: IntentDraft): Promise<JournalWrite> =>
    this.#enqueue(async (claim) => {
      const { options, clock } = this.#config;

      if (options === undefined) {
        return { status: "skipped" };
      }

      // Only a command that gave up can still be waiting when the scope changes, and its intent belongs to nothing in force.
      if (claim.generation !== this.#generation) {
        return { status: "skipped" };
      }

      const createdAt = clock.now();

      const { transitions, overflow } = this.#append(
        freezeIntent({
          ...draft,
          createdAt,
          expiresAt: createdAt + options.retention,
        }),
      );

      // A record that could not be read is not replaced by one that knows nothing of it.
      if (!this.#hydrated) {
        return this.#answerFailedWrite({
          mode: options.mode,
          transitions,
          overflow,
          cause: new Error(
            "The record could not be read, so it was not written.",
          ),
        });
      }

      try {
        await this.#call(options, "write", () =>
          options.storage.write(claim.key, serializeJournal(transitions)),
        );
      } catch (cause) {
        return this.#answerFailedWrite({
          mode: options.mode,
          transitions,
          overflow,
          cause,
        });
      }

      if (claim.generation !== this.#generation) {
        return { status: "written" };
      }

      this.#transitions = transitions;
      this.#publish({
        journal: "ready",
        dropped: this.#getDropped() + overflow,
      });

      return { status: "written" };
    });

  /** Records that the application reached a checkpoint in this boot; reporting it again changes nothing. */
  reportReady = (checkpoint: string = DEFAULT_CHECKPOINT): ReadyReport => {
    const { checkpoints } = this.#store.get();

    if (checkpoints.includes(checkpoint)) {
      return { status: "already-recorded", checkpoint };
    }

    this.#config.record("ready-reported", { reason: checkpoint });
    this.#publish({ checkpoints: freezeList([...checkpoints, checkpoint]) });

    return { status: "recorded", checkpoint };
  };

  /** Removes the record and forgets it, for a privacy flow. Nothing in it is replayed, and nothing native is cancelled. */
  clear = () =>
    this.#enqueue(async (claim) => {
      const { options, record } = this.#config;

      if (claim.generation === this.#generation) {
        this.#transitions = [];
        this.#publish();
      }

      if (options === undefined) {
        return;
      }

      try {
        await this.#call(options, "remove", () =>
          options.storage.remove(claim.key),
        );
      } catch {
        record("journal-failed", { reason: "clear" });
        this.#publish({ journal: "degraded" });
      }
    });

  /** Forgets the intents of the scope that ended, so the next session reads the record of the next one. */
  reset = () => {
    this.#generation += 1;
    this.#transitions = [];
    this.#hydrated = false;
    this.#publish({
      journal: this.#config.options === undefined ? "off" : "reading",
      dropped: 0,
    });
  };

  close = () => {
    this.#store.close();
  };

  // The record a call is about is fixed when it is made: the queue may run it after the scope changed.
  #enqueue<TValue>(
    work: (claim: { key: string; generation: number }) => Promise<TValue>,
  ): Promise<TValue> {
    const claim = {
      key: createJournalKey(this.#config.getScope()),
      generation: this.#generation,
    };

    const result = this.#queue.then(() => work(claim));

    this.#queue = result.then(
      () => {},
      () => {},
    );

    return result;
  }

  // One call to the storage, which is given up on at the deadline: a storage that never answers must not hold the queue, and every call behind it, forever. What it answers later is counted and dropped, though it cannot be recalled, so a slow write may still land.
  async #call<TValue>(
    { timeout }: ResolvedJournalOptions,
    operation: "read" | "write" | "remove",
    call: () => Promise<TValue>,
  ): Promise<TValue> {
    const { clock, record } = this.#config;
    const expired = createDeferred<never>();

    let abandoned = false;

    const cancel = clock.setTimer(() => {
      abandoned = true;
      expired.reject(
        new BeaconError({
          code: "JOURNAL_FAILED",
          message: "The journal storage did not answer in time.",
        }),
      );
    }, timeout);

    const answer = new Promise<TValue>((resolve) => resolve(call()));

    const countLate = () => {
      if (!abandoned) {
        return;
      }

      record("late-callback", { reason: `journal-${operation}` });
    };

    // Attached at once, so the rejection of an abandoned call is never unhandled.
    answer.then(countLate, countLate);

    try {
      return await Promise.race([answer, expired.promise]);
    } finally {
      cancel();
    }
  }

  // The transitions the record holds, none for a record that is absent or ignored, and `undefined` for a storage that failed.
  async #read(
    options: ResolvedJournalOptions,
    key: string,
  ): Promise<StoredTransition[] | undefined> {
    const { record } = this.#config;

    let text: string | null | undefined;

    try {
      text = await this.#call(options, "read", () => options.storage.read(key));
    } catch {
      record("journal-failed", { reason: "read" });

      return undefined;
    }

    record("journal-read");

    // A store with nothing under the key says `null`, and many say `undefined`.
    if (typeof text !== "string") {
      return [];
    }

    const parsed = parseJournal(text);

    if (parsed === undefined) {
      record("journal-ignored");

      return [];
    }

    return parsed;
  }

  // What a record holds, kept to what has not expired, judged against the boot that runs now. A record that could not be read leaves the intents this boot already holds.
  async #reconcile(
    options: ResolvedJournalOptions,
    read: StoredTransition[] | undefined,
    running: RunningApplication,
    key: string,
  ) {
    const { clock, record } = this.#config;

    const loaded = read ?? this.#transitions;
    const kept = loaded.filter(({ intent }) => intent.expiresAt > clock.now());
    const reconciled: StoredTransition[] = [];

    for (const transition of kept) {
      reconciled.push(this.#judge(transition, reconciled, running));
    }

    const changed = !isSameData(loaded, reconciled);
    const dropped = loaded.length - kept.length;

    this.#transitions = reconciled;
    this.#publish({
      journal: read === undefined ? "degraded" : "ready",
      dropped: this.#getDropped() + dropped,
    });

    if (!changed || read === undefined) {
      return;
    }

    try {
      await this.#call(options, "write", () =>
        options.storage.write(key, serializeJournal(reconciled)),
      );
    } catch {
      record("journal-failed", { reason: "write" });
      this.#publish({ journal: "degraded" });
    }
  }

  // An intent from an earlier boot gets its outcome now; one from this boot stays pending, since nothing new was observed.
  #judge(
    transition: StoredTransition,
    earlier: StoredTransition[],
    running: RunningApplication,
  ): StoredTransition {
    if (transition.outcome !== null) {
      return transition;
    }

    const outcome = reconcileIntent(transition.intent, running);

    if (outcome === "same-boot") {
      return transition;
    }

    return {
      intent: transition.intent,
      outcome,
      attempts:
        outcome === "target-not-running"
          ? countAttempts(transition.intent, earlier) + 1
          : 0,
    };
  }

  #append(intent: StoredTransition["intent"]) {
    const entry: StoredTransition = {
      intent,
      outcome: null,
      attempts: countAttempts(intent, this.#transitions),
    };

    const all = [...this.#transitions, entry];
    const overflow = Math.max(0, all.length - JOURNAL_CAPACITY);

    return { transitions: all.slice(overflow), overflow };
  }

  #answerFailedWrite({
    mode,
    transitions,
    overflow,
    cause,
  }: {
    mode: "best-effort" | "required";
    transitions: StoredTransition[];
    overflow: number;
    cause: unknown;
  }): JournalWrite {
    this.#config.record("journal-failed", { reason: "write" });

    if (mode === "required") {
      this.#publish({ journal: "degraded" });

      return {
        status: "failed",
        error: new BeaconError({
          code: "JOURNAL_FAILED",
          message: "The transition intent could not be persisted.",
          cause,
        }),
      };
    }

    // Best effort goes on with the intent in memory only, so it correlates this boot and no later one.
    this.#transitions = transitions;
    this.#publish({
      journal: "degraded",
      dropped: this.#getDropped() + overflow,
    });

    return { status: "degraded" };
  }

  #toLatest(): Reconciliation | null {
    const latest = this.#transitions.at(-1);
    const { options } = this.#config;

    if (latest === undefined || options === undefined) {
      return null;
    }

    return Object.freeze({
      intent: latest.intent,
      outcome: latest.outcome ?? "same-boot",
      attempts: latest.attempts,
      exhausted: latest.attempts >= options.budget,
    });
  }

  #getDropped() {
    return this.#store.get().dropped;
  }

  #publish(patch: Partial<Omit<TransitionState, "revision">> = {}) {
    const current = this.#store.get();

    const next: TransitionState = {
      ...current,
      latest: this.#toLatest(),
      ...patch,
    };

    if (isSameData({ ...next, revision: 0 }, { ...current, revision: 0 })) {
      return;
    }

    commitChange((transaction) =>
      transaction.set(
        this.#store,
        Object.freeze({ ...next, revision: current.revision + 1 }),
      ),
    );
  }
}

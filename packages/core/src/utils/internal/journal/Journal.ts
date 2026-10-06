import type { IntentDraft } from "src/types/internal/IntentDraft";
import type { JournalConfig } from "src/types/internal/JournalConfig";
import type { JournalRead } from "src/types/internal/JournalRead";
import type { JournalWrite } from "src/types/internal/JournalWrite";
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
import { freezeList } from "src/utils/internal/common/freezeList";
import { isSameData } from "src/utils/internal/common/isSameData";
import { countAttempts } from "src/utils/internal/journal/countAttempts";
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
 * hydration that arrives after its session ended is dropped. Without a
 * configured journal it does nothing and says it is off.
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
  hydrate = (
    session: Session,
    getRunning: () => Promise<RunningApplication>,
  ) => {
    const claim = this.#claim();

    return this.#enqueue(async () => {
      if (this.#config.options === undefined || this.#hydrated) {
        return;
      }

      const read = await this.#read(claim.key);
      const running = await getRunning();

      // A read that arrives after its session or its scope ended describes nothing that is still true.
      if (!session.scope.isActive() || claim.generation !== this.#generation) {
        return;
      }

      this.#hydrated = read.status !== "failed";
      await this.#reconcile(read, running, claim.key);
    });
  };

  /** Persists an intent before its command is dispatched, and answers whether the command may go on. */
  write = (draft: IntentDraft): Promise<JournalWrite> => {
    const claim = this.#claim();

    return this.#enqueue(async () => {
      const { options, clock } = this.#config;

      if (options === undefined) {
        return { status: "skipped" };
      }

      // Only a command that gave up can still be waiting when the scope changes, and its intent belongs to nothing in force.
      if (claim.generation !== this.#generation) {
        return { status: "skipped" };
      }

      const createdAt = clock.now();

      const { transitions, overflow } = this.#append({
        ...draft,
        createdAt,
        expiresAt: createdAt + options.retention,
      });

      // A record that could not be read is not replaced by one that knows nothing of it.
      if (!this.#hydrated) {
        return this.#handleWriteFailure({
          mode: options.mode,
          transitions,
          overflow,
          cause: new Error(
            "The record could not be read, so it was not written.",
          ),
        });
      }

      try {
        await options.storage.write(claim.key, serializeJournal(transitions));
      } catch (cause) {
        return this.#handleWriteFailure({
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
  };

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
  clear = () => {
    const claim = this.#claim();

    return this.#enqueue(async () => {
      const { options, record } = this.#config;

      if (claim.generation === this.#generation) {
        this.#transitions = [];
        this.#publish({ latest: null });
      }

      if (options === undefined) {
        return;
      }

      try {
        await options.storage.remove(claim.key);
      } catch {
        record("journal-failed", { reason: "clear" });
        this.#publish({ journal: "degraded" });
      }
    });
  };

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
  #claim() {
    return {
      key: createJournalKey(this.#config.getScope()),
      generation: this.#generation,
    };
  }

  #enqueue<TValue>(work: () => Promise<TValue>): Promise<TValue> {
    const result = this.#queue.then(work);

    this.#queue = result.then(
      () => {},
      () => {},
    );

    return result;
  }

  async #read(key: string): Promise<JournalRead> {
    const { options, record } = this.#config;

    if (options === undefined) {
      return { status: "absent" };
    }

    try {
      const text = await options.storage.read(key);

      record("journal-read");

      if (text === null) {
        return { status: "absent" };
      }

      return { status: "read", text };
    } catch {
      record("journal-failed", { reason: "read" });

      return { status: "failed" };
    }
  }

  // What a record holds, kept to what has not expired, judged against the boot that runs now.
  async #reconcile(
    read: JournalRead,
    running: RunningApplication,
    key: string,
  ) {
    const { options, clock, record } = this.#config;

    if (options === undefined) {
      return;
    }

    const loaded = this.#load(read);
    const kept = loaded.filter(({ intent }) => intent.expiresAt > clock.now());
    const reconciled: StoredTransition[] = [];

    for (const transition of kept) {
      reconciled.push(this.#judge(transition, reconciled, running));
    }

    const changed = !isSameData(loaded, reconciled);
    const dropped = loaded.length - kept.length;

    this.#transitions = reconciled;
    this.#publish({
      journal: read.status === "failed" ? "degraded" : "ready",
      dropped: this.#getDropped() + dropped,
    });

    if (!changed || read.status === "failed") {
      return;
    }

    try {
      await options.storage.write(key, serializeJournal(reconciled));
    } catch {
      record("journal-failed", { reason: "write" });
      this.#publish({ journal: "degraded" });
    }
  }

  #load(read: JournalRead) {
    if (read.status === "failed") {
      return this.#transitions;
    }

    if (read.status === "absent") {
      return [];
    }

    const parsed = parseJournal(read.text);

    if (parsed === undefined) {
      this.#config.record("journal-ignored");

      return [];
    }

    return parsed;
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

  #handleWriteFailure({
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
    this.#publish({ journal: "degraded" });

    if (mode === "required") {
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
      latest: this.#toLatest(),
      dropped: this.#getDropped() + overflow,
    });

    return { status: "degraded" };
  }

  #toLatest(): Reconciliation | null {
    const latest = this.#transitions.at(-1);

    if (latest === undefined) {
      return null;
    }

    const budget = this.#config.options?.budget ?? 0;

    return {
      intent: latest.intent,
      outcome: latest.outcome ?? "same-boot",
      attempts: latest.attempts,
      exhausted: latest.attempts >= budget,
    };
  }

  #getDropped() {
    return this.#store.get().dropped;
  }

  #publish(patch: Partial<Omit<TransitionState, "revision">>) {
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

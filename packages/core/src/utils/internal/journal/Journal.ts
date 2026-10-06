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
  DEFAULT_JOURNAL_BUDGET,
  DEFAULT_JOURNAL_RETENTION,
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
  hydrate = (session: Session, getRunning: () => Promise<RunningApplication>) =>
    this.#enqueue(async () => {
      if (this.#config.options === undefined || this.#hydrated) {
        return;
      }

      const read = await this.#read();
      const running = await getRunning();

      // A read that arrives after its session ended describes nothing that is still true.
      if (!session.scope.isActive()) {
        return;
      }

      this.#hydrated = read.status !== "failed";
      await this.#reconcile(read, running);
    });

  /** Persists an intent before its command is dispatched, and answers whether the command may go on. */
  write = (draft: IntentDraft): Promise<JournalWrite> =>
    this.#enqueue(async () => {
      const { options, clock, getScope } = this.#config;

      if (options === undefined) {
        return { status: "skipped" };
      }

      const createdAt = clock.now();

      const { transitions, overflow } = this.#append({
        ...draft,
        createdAt,
        expiresAt: createdAt + (options.retention ?? DEFAULT_JOURNAL_RETENTION),
      });

      try {
        await options.storage.write(
          createJournalKey(getScope()),
          serializeJournal(transitions),
        );
      } catch (cause) {
        return this.#handleWriteFailure(options.mode, transitions, cause);
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
    this.#enqueue(async () => {
      const { options, getScope, record } = this.#config;

      this.#transitions = [];
      this.#publish({ latest: null });

      if (options === undefined) {
        return;
      }

      try {
        await options.storage.remove(createJournalKey(getScope()));
      } catch {
        record("journal-failed", { reason: "clear" });
        this.#publish({ journal: "degraded" });
      }
    });

  /** Forgets the intents of the scope that ended, so the next session reads the record of the next one. */
  reset = () => {
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

  #enqueue<TValue>(work: () => Promise<TValue>): Promise<TValue> {
    const result = this.#queue.then(work);

    this.#queue = result.then(
      () => {},
      () => {},
    );

    return result;
  }

  async #read(): Promise<JournalRead> {
    const { options, getScope, record } = this.#config;

    if (options === undefined) {
      return { status: "absent" };
    }

    try {
      const text = await options.storage.read(createJournalKey(getScope()));

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
  async #reconcile(read: JournalRead, running: RunningApplication) {
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
      await options.storage.write(
        createJournalKey(this.#config.getScope()),
        serializeJournal(reconciled),
      );
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

  #handleWriteFailure(
    mode: "best-effort" | "required",
    transitions: StoredTransition[],
    cause: unknown,
  ): JournalWrite {
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
    this.#publish({ latest: this.#toLatest() });

    return { status: "degraded" };
  }

  #toLatest(): Reconciliation | null {
    const latest = this.#transitions.at(-1);

    if (latest === undefined) {
      return null;
    }

    const budget = this.#config.options?.budget ?? DEFAULT_JOURNAL_BUDGET;

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

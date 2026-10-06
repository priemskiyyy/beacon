import type { BeaconDiagnostics } from "src/types/BeaconDiagnostics";
import type { BeaconErrorInfo } from "src/types/BeaconErrorInfo";
import type { BeaconOptions } from "src/types/BeaconOptions";
import type { BeaconStatus } from "src/types/BeaconStatus";
import type { CheckOptions } from "src/types/CheckOptions";
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { CheckReport } from "src/types/CheckReport";
import type { CommandInput } from "src/types/internal/CommandInput";
import type { CommandTarget } from "src/types/internal/CommandTarget";
import type { Disruptions } from "src/types/Disruptions";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { Session } from "src/types/internal/Session";
import type { ObservableValue } from "src/types/ObservableValue";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { ScopeReplacement } from "src/types/ScopeReplacement";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteHandle } from "src/types/RouteHandle";
import type { RunningApplication } from "src/types/RunningApplication";
import type { RunningSubject } from "src/types/RunningSubject";
import type { ReadyReport } from "src/types/ReadyReport";
import type { SupportState } from "src/types/SupportState";
import type { TransitionState } from "src/types/TransitionState";
import { BeaconError } from "src/utils/BeaconError";
import {
  DEFAULT_CHECK_TIMEOUT,
  DEFAULT_JOURNAL_TIMEOUT,
  DEFAULT_RUNNING_TIMEOUT,
  DEFAULT_SETTLEMENT_TIMEOUT,
} from "src/utils/constants/defaults";
import { CommandCoordinator } from "src/utils/internal/commands/CommandCoordinator";
import { Journal } from "src/utils/internal/journal/Journal";
import { DisruptionRegistry } from "src/utils/internal/disruptions/DisruptionRegistry";
import { createSystemClock } from "src/utils/internal/clock/createSystemClock";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";
import { untilAborted } from "src/utils/internal/common/untilAborted";
import { freezeList } from "src/utils/internal/common/freezeList";
import { isSameData } from "src/utils/internal/common/isSameData";
import { createDisposedError } from "src/utils/internal/errors/createDisposedError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";
import { resolveJournalOptions } from "src/utils/internal/options/resolveJournalOptions";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";
import { mapHandles, mapNames } from "src/utils/internal/routes/mapRoutes";
import { readCapabilities } from "src/utils/internal/routes/readCapabilities";
import { RouteRegistry } from "src/utils/internal/routes/RouteRegistry";
import { BeaconRuntime } from "src/utils/internal/runtime/BeaconRuntime";
import { RunningRegistry } from "src/utils/internal/running/RunningRegistry";

/**
 * One application-owned model of release awareness over named routes.
 * Constructing it, reading it and subscribing to it start nothing; `start()`
 * opens the observation session, and `dispose()` ends it for good.
 *
 * @example
 * ```ts
 * const beacon = new Beacon({
 *   scope,
 *   running: { boot: { id: BOOT_ID }, web: readWebRelease },
 *   routes: { web },
 * });
 * const stop = beacon.start();
 *
 * await beacon.check({ reason: "startup" });
 * stop();
 * ```
 */
export class Beacon<
  TRoutes extends Record<string, RouteDefinition> = Record<never, never>,
> {
  #runtime: BeaconRuntime;
  #running: RunningRegistry;
  #routes: RouteRegistry;
  #journal: Journal;
  #scope: ReleaseScope;
  #commands: CommandCoordinator;
  #diagnostics: Diagnostics;
  #entries: RouteEntry[];
  #handles: {
    [TName in keyof TRoutes & string]: RouteHandle<TName, TRoutes[TName]>;
  };

  /**
   * Where the observation session stands: idle, running, stopped or disposed.
   *
   * @example
   * ```ts
   * const active = beacon.status.get().state === "running";
   * ```
   */
  status: ObservableValue<BeaconStatus>;

  /**
   * The names of the routes, as they were defined, for a presentation that
   * lists them. The list is frozen.
   *
   * @example
   * ```ts
   * const names = beacon.routeNames;
   * ```
   */
  routeNames: Array<keyof TRoutes & string>;

  /**
   * What is executing right now, per subject, as far as the local readers
   * have said. A subject that is not read yet is pending, never an old version.
   *
   * @example
   * ```ts
   * const { web } = beacon.running.get();
   * ```
   */
  running: ObservableValue<RunningApplication>;

  /**
   * Whether the running application is acceptable under the application's own
   * policy: unknown until a policy is accepted and after it lapses, with the
   * last decision kept beside it. A failing check never turns `supported` into
   * `unsupported`.
   *
   * @example
   * ```ts
   * const { status } = beacon.support.get();
   * ```
   */
  support: ObservableValue<SupportState>;

  /**
   * What the transition journal knows: whether it is off, being read or
   * degraded, the latest intent and what the running facts say about it, and
   * the readiness checkpoints this boot reported. Without a journal it says it
   * is off, and no cross-boot correlation is claimed.
   *
   * @example
   * ```ts
   * const { latest } = beacon.transitions.get();
   * ```
   */
  transitions: ObservableValue<TransitionState>;

  /**
   * A passive snapshot and event stream for logs and devtools.
   *
   * @example
   * ```ts
   * const { session } = beacon.diagnostics.get();
   * ```
   */
  diagnostics: BeaconDiagnostics;

  /**
   * Where the application registers what a disruptive command must not catch,
   * such as a document with unsaved edits.
   *
   * @example
   * ```ts
   * const unregister = beacon.disruptions.register(participant);
   * ```
   */
  disruptions: Disruptions;

  constructor({
    scope,
    running,
    routes,
    policy,
    journal,
    timeouts = {},
    clock = createSystemClock(),
  }: BeaconOptions<TRoutes>) {
    const runningTimeout = resolveDuration(
      "timeouts.running",
      timeouts.running,
      DEFAULT_RUNNING_TIMEOUT,
    );

    const checkTimeout = resolveDuration(
      "timeouts.check",
      timeouts.check,
      DEFAULT_CHECK_TIMEOUT,
    );

    const settlementTimeout = resolveDuration(
      "timeouts.settlement",
      timeouts.settlement,
      DEFAULT_SETTLEMENT_TIMEOUT,
    );

    const journalTimeout = resolveDuration(
      "timeouts.journal",
      timeouts.journal,
      DEFAULT_JOURNAL_TIMEOUT,
    );

    const journalOptions = resolveJournalOptions(journal, journalTimeout);

    this.#diagnostics = new Diagnostics({
      clock,
      getSession: () => this.#runtime.getSession()?.id ?? null,
      getStatus: () => this.#runtime.status.get().state,
    });

    const reportListenerError = (error: unknown) => {
      this.#diagnostics.record("listener-error");
      reportUnhandledError(error);
    };

    const reportCleanupError = (error: unknown) => {
      this.#diagnostics.record("cleanup-error");
      reportUnhandledError(error);
    };

    const createListeners = () => new Listeners(reportListenerError);

    this.#running = new RunningRegistry({
      readers: running,
      clock,
      timeout: runningTimeout,
      listeners: createListeners(),
      record: this.#diagnostics.record,
    });

    this.#scope = Object.freeze({ ...scope });

    this.#routes = new RouteRegistry({
      definitions: routes,
      policy: policy ?? null,
      getScope: () => this.#scope,
      running: this.#running.state,
      clock,
      timeout: checkTimeout,
      createListeners,
      record: this.#diagnostics.record,
    });

    this.#running.state.subscribe(this.#routes.reselect);

    const disruptions = new DisruptionRegistry({
      clock,
      timeout: settlementTimeout,
      reportError: reportListenerError,
    });

    this.#journal = new Journal({
      options: journalOptions,
      getScope: () => this.#scope,
      getRunning: (session) => this.#getSettledRunning(session),
      clock,
      listeners: createListeners(),
      record: this.#diagnostics.record,
    });

    this.#commands = new CommandCoordinator({
      ledger: this.#routes.getLedger(),
      disruptions,
      journal: this.#journal,
      getRunning: () => this.#running.state.get(),
      waitForRunning: (session, subject) =>
        this.#running.read(session)[subject],
      getSession: () => this.#runtime.getSession(),
      now: () => clock.now(),
      createInactiveError: () => this.#describeInactive(),
      record: this.#diagnostics.record,
    });

    this.#runtime = new BeaconRuntime({
      listeners: createListeners(),
      onStart: (session) => {
        // Every step calls the application, which may have ended this very session, and nothing is opened for one that ended.
        this.#running.read(session);

        if (!session.resources.isActive()) {
          return;
        }

        this.#routes.open(session);

        if (!session.resources.isActive()) {
          return;
        }

        this.#journal.hydrate(session);
      },
      onDispose: () => {
        this.#running.close();
        this.#commands.close();
        this.#journal.close();
        this.#routes.close();
        this.#diagnostics.record("disposed");
        this.#diagnostics.close();
      },
      record: this.#diagnostics.record,
      reportCleanupError,
    });

    this.routeNames = freezeList(Object.keys(routes));
    this.#entries = this.#routes.getEntries();
    this.#handles = mapHandles<TRoutes>(this.#entries, (entry) =>
      this.#createHandle(entry),
    );
    this.status = this.#runtime.status;
    this.running = this.#running.state;
    this.support = this.#routes.getSupport();
    this.transitions = this.#journal.state;
    this.diagnostics = this.#diagnostics.view;
    this.disruptions = Object.freeze({ register: disruptions.register });
  }

  /**
   * The stable handle of one route. A name that was never defined fails to
   * compile, and throws `INVALID_CONFIGURATION` when it arrives from untyped
   * code. Acquiring or observing it is passive.
   *
   * @example
   * ```ts
   * const web = beacon.route("web");
   * ```
   */
  route = <TName extends keyof TRoutes & string>(
    name: TName,
  ): RouteHandle<TName, TRoutes[TName]> => {
    if (!Object.hasOwn(this.#handles, name)) {
      throw new BeaconError({
        code: "INVALID_CONFIGURATION",
        message: `The route "${name}" is not defined.`,
      });
    }

    return this.#handles[name];
  };

  /**
   * Opens the observation session and answers its stop: it reads the running
   * facts and opens each route, and fetches nothing from a release authority.
   * Starting again while the session is open answers the same stop. That stop
   * ends the session that stands for its start, including the one
   * `replaceScope` restarted for it, and never one that a later, independent
   * start opened.
   *
   * @example
   * ```ts
   * const stop = beacon.start();
   * ```
   */
  start = () => this.#runtime.start();

  /**
   * Puts another scope in force, all at once. Every result of the old scope's
   * reads is fenced, what it taught is forgotten (the documents, the offers
   * and the references to them, the prepared targets, the support evaluated
   * from them and the journal's intents), and the session, if one is open,
   * starts again with the next scope, under the stop its `start()` answered.
   * What is running is never rewritten: a new environment label does not
   * change the build in memory. A route whose operation is running or
   * unresolved blocks the replacement, since that work cannot be given to
   * another scope: acknowledge it first.
   *
   * @example
   * ```ts
   * const replacement = beacon.replaceScope({ ...scope, environment: "staging" });
   * ```
   */
  replaceScope = (next: ReleaseScope): ScopeReplacement => {
    if (this.#isDisposed()) {
      throw createDisposedError();
    }

    const busy = this.#commands.findBusy();

    if (busy !== undefined) {
      return { status: "blocked", route: busy };
    }

    if (isSameData(this.#scope, next)) {
      return { status: "unchanged" };
    }

    // Nothing here waits, so no answer of the old scope lands between these steps. The next scope is in force, and everything the last taught is forgotten, before the session ends: whatever a listener starts, checks or replaces meanwhile speaks for the scope that stays, and a check made while the old session is still open is superseded when it ends.
    this.#scope = Object.freeze({ ...next });
    this.#routes.reset();
    this.#journal.reset();
    this.#runtime.restart();

    return { status: "replaced" };
  };

  /**
   * Ends the open session: callbacks fall silent and owned timers stop. It
   * does not undo native side effects.
   *
   * @example
   * ```ts
   * beacon.stop();
   * ```
   */
  stop = () => {
    this.#runtime.stop();
  };

  /**
   * Asks every route's authority and the support policy's, sharing one read
   * per authority, all started in one turn once the running facts it needs are
   * in. With a support policy that is every configured running fact, since the
   * policy reads them all, each one bounded by `timeouts.running`; without one,
   * only the facts the routes select against, as a route's own `check()` does.
   * Each outcome is its own: a failure of one never hides the success of
   * another, and none of them means anything is on offer. It never rejects.
   *
   * @example
   * ```ts
   * const report = await beacon.check({ reason: "startup" });
   * ```
   */
  check = async (
    options: CheckOptions = {},
  ): Promise<CheckReport<keyof TRoutes & string>> => {
    const ready = await this.#prepareChecks(
      this.#entries,
      this.#getCheckedSubjects(),
      options,
    );

    if (ready.status === "stopped") {
      return {
        routes: mapNames(this.routeNames, () => ready.outcome()),
        support: this.#routes.hasPolicy() ? ready.outcome() : null,
      };
    }

    // Every read starts in this turn, so routes and policy over one source join one read however fast it answers.
    const [outcomes, support] = await Promise.all([
      Promise.all(
        this.#entries.map((entry) =>
          entry.runtime.check(ready.session, ready.read),
        ),
      ),
      this.#routes.checkPolicy(ready.session, ready.read),
    ]);

    return {
      routes: mapNames(this.routeNames, (name) => {
        const index = this.routeNames.indexOf(name);

        return outcomes[index] ?? { status: "superseded" };
      }),
      support,
    };
  };

  /**
   * Records that the application reached a checkpoint in this boot, such as
   * its primary screen with the data it needs. It says application code got
   * there, not that nothing will crash later or that stored data is safe in
   * both directions, and nothing reports it for you. Idempotent per
   * checkpoint. After `dispose()` nothing can be recorded, so it throws
   * `DISPOSED` instead of answering that it did.
   *
   * @example
   * ```ts
   * beacon.reportReady({ checkpoint: "primary-screen" });
   * ```
   */
  reportReady = ({ checkpoint }: { checkpoint?: string } = {}): ReadyReport => {
    if (this.#isDisposed()) {
      throw createDisposedError();
    }

    return this.#journal.reportReady(checkpoint);
  };

  /**
   * Removes the journal's record, for a privacy flow. Nothing in it is
   * replayed, and no native operation is cancelled or inferred. It still
   * removes the stored record after `dispose()`, since erasing what a finished
   * Beacon left is the point of the flow, and the last snapshot stays as it
   * was.
   *
   * @example
   * ```ts
   * await beacon.clearJournal();
   * ```
   */
  clearJournal = () => this.#journal.clear();

  /**
   * Ends the Beacon for good: the session stops, and the last snapshots stay
   * readable and unchanged. Idempotent.
   *
   * @example
   * ```ts
   * beacon.dispose();
   * ```
   */
  dispose = () => {
    this.#runtime.dispose();
  };

  // Every subject's reader has answered, failed or timed out; the journal reads the facts once they are what they will be.
  async #getSettledRunning(session: Session) {
    await this.#awaitRunning(session, RUNNING_SUBJECTS);

    return this.#running.state.get();
  }

  #createHandle(entry: RouteEntry) {
    const commands = Object.entries(entry.commands).map(([name, command]) => {
      const target: CommandTarget = { entry, name, command };

      return [
        name,
        (input: CommandInput = {}) => this.#commands.run(target, input),
      ];
    });

    return {
      ...Object.fromEntries(commands),
      state: entry.record.state,
      native: entry.record.native,
      capabilities: readCapabilities(entry.commands),
      check: (options: CheckOptions = {}) => this.#checkRoute(entry, options),
      acknowledge: () => this.#commands.acknowledge(entry),
    };
  }

  async #checkRoute(
    entry: RouteEntry,
    options: CheckOptions,
  ): Promise<CheckOutcome> {
    const ready = await this.#prepareChecks(
      [entry],
      entry.runtime.dependsOn,
      options,
    );

    if (ready.status === "stopped") {
      return ready.outcome();
    }

    return entry.runtime.check(ready.session, ready.read);
  }

  // The support policy reads every running subject, so a check that includes it waits for all of them, and only then starts any read.
  #getCheckedSubjects() {
    if (this.#routes.hasPolicy()) {
      return RUNNING_SUBJECTS;
    }

    return this.#entries.flatMap(({ runtime }) => runtime.dependsOn);
  }

  // Waits once for the running subjects the checks depend on, or says why none may go on.
  async #prepareChecks(
    entries: RouteEntry[],
    subjects: RunningSubject[],
    options: CheckOptions,
  ): Promise<PreparedChecks> {
    const session = this.#runtime.getSession();

    if (session === null) {
      return {
        status: "stopped",
        outcome: () => this.#createNotActiveOutcome(),
      };
    }

    for (const { name } of entries) {
      this.#diagnostics.record("check-started", {
        route: name,
        reason: options.reason,
      });
    }

    const running = await this.#awaitRunning(session, subjects, options.signal);

    if (running === "aborted") {
      return { status: "stopped", outcome: () => ({ status: "cancelled" }) };
    }

    if (this.#runtime.getSession() !== session) {
      return { status: "stopped", outcome: () => ({ status: "superseded" }) };
    }

    return {
      status: "ready",
      session,
      read: { mode: options.mode ?? "join", signal: options.signal },
    };
  }

  // A check waits only for the running subjects it was given, not for every unrelated reader, and only as long as its caller does.
  async #awaitRunning(
    session: Session,
    subjects: RunningSubject[],
    signal?: AbortSignal,
  ) {
    const reads = this.#running.read(session);
    const ready = Promise.all(subjects.map((subject) => reads[subject]));

    if (signal === undefined) {
      await ready;

      return "ready";
    }

    const raced = await untilAborted(ready, signal);

    if (raced.status === "aborted") {
      return "aborted";
    }

    return "ready";
  }

  #isDisposed() {
    return this.#runtime.status.get().state === "disposed";
  }

  #createNotActiveOutcome(): CheckOutcome {
    return { status: "failed", attempt: 0, error: this.#describeInactive() };
  }

  // Why a call outside a session cannot run: the Beacon is disposed, or was never started.
  #describeInactive(): BeaconErrorInfo {
    if (this.#isDisposed()) {
      return toErrorInfo(createDisposedError());
    }

    return toErrorInfo(
      new BeaconError({
        code: "NOT_STARTED",
        message: "An operation needs a started Beacon.",
      }),
    );
  }
}

/** Why no check may go on, or the session whose reads it may start and how. */
type PreparedChecks =
  | { status: "ready"; session: Session; read: ReadOptions }
  | { status: "stopped"; outcome: () => CheckOutcome };

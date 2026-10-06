import type { BeaconDiagnostics } from "src/types/BeaconDiagnostics";
import type { BeaconOptions } from "src/types/BeaconOptions";
import type { BeaconStatus } from "src/types/BeaconStatus";
import type { CheckOptions } from "src/types/CheckOptions";
import type { CheckOutcome } from "src/types/CheckOutcome";
import type { CheckReport } from "src/types/CheckReport";
import type { CommandInput } from "src/types/internal/CommandInput";
import type { CommandTarget } from "src/types/internal/CommandTarget";
import type { Disruptions } from "src/types/Disruptions";
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
  DEFAULT_RUNNING_TIMEOUT,
  DEFAULT_SETTLEMENT_TIMEOUT,
} from "src/utils/constants/defaults";
import { CommandCoordinator } from "src/utils/internal/commands/CommandCoordinator";
import { Journal } from "src/utils/internal/journal/Journal";
import { DisruptionRegistry } from "src/utils/internal/disruptions/DisruptionRegistry";
import { createSystemClock } from "src/utils/internal/clock/createSystemClock";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";
import { untilAborted } from "src/utils/internal/common/untilAborted";
import { isSameData } from "src/utils/internal/common/isSameData";
import { createDisposedError } from "src/utils/internal/errors/createDisposedError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";
import { resolveJournalOptions } from "src/utils/internal/options/resolveJournalOptions";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";
import { RUNNING_SUBJECTS } from "src/utils/constants/subjects";
import { getSubjects } from "src/utils/internal/routes/getSubjects";
import { mapHandles, mapNames } from "src/utils/internal/routes/mapRoutes";
import { getCommands } from "src/utils/internal/routes/getCommands";
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
  #disruptions: DisruptionRegistry;
  #journal: Journal;
  #scope: ReleaseScope;
  #commands: CommandCoordinator;
  #diagnostics: Diagnostics;
  #names: Array<keyof TRoutes & string>;
  #handles: {
    [TName in keyof TRoutes & string]: RouteHandle<TName, TRoutes[TName]>;
  };

  #initialReads: Record<RunningSubject, Promise<void>> = mapNames(
    RUNNING_SUBJECTS,
    () => Promise.resolve(),
  );

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

    this.#diagnostics = new Diagnostics({
      clock,
      getSession: () => this.#getSessionNumber(),
      collect: (counters) => ({
        status: this.#runtime.status.get().state,
        session: this.#getSessionNumber(),
        counters,
      }),
    });

    const settlementTimeout = resolveDuration(
      "timeouts.settlement",
      timeouts.settlement,
      DEFAULT_SETTLEMENT_TIMEOUT,
    );

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

    this.#running.state.subscribe(this.#routes.handleRunningChange);

    this.#disruptions = new DisruptionRegistry({
      clock,
      timeout: settlementTimeout,
      reportError: reportListenerError,
    });

    this.#journal = new Journal({
      options: resolveJournalOptions(journal),
      getScope: () => this.#scope,
      clock,
      listeners: createListeners(),
      record: this.#diagnostics.record,
    });

    this.#commands = new CommandCoordinator({
      ledger: this.#routes.getLedger(),
      disruptions: this.#disruptions,
      journal: this.#journal,
      getRunning: () => this.#running.state.get(),
      getSession: () => this.#runtime.getSession(),
      now: () => clock.now(),
      createInactiveError: () => this.#createInactiveError(),
      record: this.#diagnostics.record,
    });

    this.#runtime = new BeaconRuntime({
      listeners: createListeners(),
      onStart: (session) => {
        this.#initialReads = this.#running.read(session);
        this.#routes.open(session);
        this.#journal.hydrate(session, () => this.#readRunning());
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

    this.#names = Object.keys(routes);
    this.#handles = mapHandles<TRoutes>(this.#names, (name) =>
      this.#createHandle(name),
    );
    this.status = this.#runtime.status;
    this.running = this.#running.state;
    this.support = this.#routes.getSupport();
    this.transitions = this.#journal.state;
    this.diagnostics = this.#diagnostics.view;
    this.disruptions = Object.freeze({ register: this.#disruptions.register });
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
   * Opens the observation session and answers its stop. Starting again while
   * the session is open answers the same stop, and an old session's stop never
   * ends a newer one. It fetches, registers and schedules nothing else.
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
   * starts again with the next scope. What is running is never rewritten: a
   * new environment label does not change the build in memory. A route whose
   * operation is running or unresolved blocks the replacement, since that work
   * cannot be given to another scope: acknowledge it first.
   *
   * @example
   * ```ts
   * const replacement = beacon.replaceScope({ ...scope, environment: "staging" });
   * ```
   */
  replaceScope = (next: ReleaseScope): ScopeReplacement => {
    if (this.#runtime.status.get().state === "disposed") {
      throw createDisposedError();
    }

    const busy = this.#commands.findBusy();

    if (busy !== undefined) {
      return { status: "blocked", route: busy };
    }

    if (isSameData(this.#scope, next)) {
      return { status: "unchanged" };
    }

    const wasOpen = this.#runtime.getSession() !== null;

    this.#runtime.stop();
    this.#scope = Object.freeze({ ...next });
    this.#routes.reset();
    this.#journal.reset();

    if (wasOpen) {
      this.#runtime.start();
    }

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
   * Asks every route's authority, sharing one read per authority. Each route's
   * outcome is its own: a failure of one never hides the success of another,
   * and none of them means anything is on offer. It never rejects.
   *
   * @example
   * ```ts
   * const report = await beacon.check({ reason: "startup" });
   * ```
   */
  check = async (
    options: CheckOptions = {},
  ): Promise<CheckReport<keyof TRoutes & string>> => {
    const [outcomes, support] = await Promise.all([
      Promise.all(this.#names.map((name) => this.#checkRoute(name, options))),
      this.#checkSupport(options),
    ]);

    return {
      routes: mapNames(this.#names, (name) => {
        const index = this.#names.indexOf(name);

        return outcomes[index] ?? SUPERSEDED_OUTCOME;
      }),
      support,
    };
  };

  /**
   * Records that the application reached a checkpoint in this boot, such as
   * its primary screen with the data it needs. It says application code got
   * there, not that nothing will crash later or that stored data is safe in
   * both directions, and nothing reports it for you. Idempotent per
   * checkpoint.
   *
   * @example
   * ```ts
   * beacon.reportReady({ checkpoint: "primary-screen" });
   * ```
   */
  reportReady = ({ checkpoint }: { checkpoint?: string } = {}): ReadyReport =>
    this.#journal.reportReady(checkpoint);

  /**
   * Removes the journal's record, for a privacy flow. Nothing in it is
   * replayed, and no native operation is cancelled or inferred.
   *
   * @example
   * ```ts
   * await beacon.clearJournal();
   * ```
   */
  clearJournal = () => this.#journal.clear();

  /**
   * Ends the Beacon for good: the session stops, and the last snapshots stay
   * readable. Idempotent.
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
  async #readRunning() {
    await this.#awaitRunning(RUNNING_SUBJECTS);

    return this.#running.state.get();
  }

  #getSessionNumber() {
    const session = this.#runtime.getSession();

    if (session === null) {
      return null;
    }

    return session.id;
  }

  #createHandle(name: string) {
    const entry = this.#routes.getEntry(name);

    if (entry === undefined) {
      throw new BeaconError({
        code: "INVALID_CONFIGURATION",
        message: `The route "${name}" is not defined.`,
      });
    }

    const commands = Object.entries(getCommands(entry.definition)).flatMap(
      ([commandName, command]) => {
        if (command === undefined) {
          return [];
        }

        const target: CommandTarget = { entry, name: commandName, command };

        return [
          [
            commandName,
            (input: CommandInput = {}) => this.#commands.run(target, input),
          ],
        ];
      },
    );

    return {
      ...Object.fromEntries(commands),
      state: entry.record.state,
      native: entry.record.native,
      capabilities: readCapabilities(entry.definition),
      check: (options: CheckOptions = {}) => this.#checkRoute(name, options),
      acknowledge: () => this.#commands.acknowledge(entry),
    };
  }

  async #checkSupport(options: CheckOptions): Promise<CheckOutcome | null> {
    if (!this.#routes.hasPolicy()) {
      return null;
    }

    const session = this.#runtime.getSession();

    if (session === null) {
      return this.#createNotActiveOutcome();
    }

    return this.#routes.checkPolicy(session, {
      mode: options.mode ?? "join",
      signal: options.signal,
    });
  }

  async #checkRoute(
    name: string,
    options: CheckOptions,
  ): Promise<CheckOutcome> {
    const session = this.#runtime.getSession();

    if (session === null) {
      return this.#createNotActiveOutcome();
    }

    this.#diagnostics.record("check-requested", {
      route: name,
      ...(options.reason === undefined ? {} : { reason: options.reason }),
    });

    const running = await this.#awaitRunning(
      this.#getSubjects(name),
      options.signal,
    );

    if (running === "aborted") {
      return { status: "cancelled" };
    }

    if (!this.#isCurrent(session)) {
      return { status: "superseded" };
    }

    return this.#routes.check(session, name, {
      mode: options.mode ?? "join",
      signal: options.signal,
    });
  }

  // A check waits only for the running subjects it depends on, not for every unrelated reader, and only as long as its caller does.
  async #awaitRunning(subjects: RunningSubject[], signal?: AbortSignal) {
    const ready = Promise.all(
      subjects.map((subject) => this.#initialReads[subject]),
    );

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

  #getSubjects(name: string) {
    const entry = this.#routes.getEntry(name);

    if (entry === undefined) {
      return [];
    }

    return getSubjects(entry.definition);
  }

  #isCurrent(session: Session) {
    return this.#runtime.getSession() === session;
  }

  #createNotActiveOutcome(): CheckOutcome {
    return {
      status: "failed",
      attempt: 0,
      error: toErrorInfo(this.#createInactiveError()),
    };
  }

  #createInactiveError() {
    if (this.#runtime.status.get().state === "disposed") {
      return createDisposedError();
    }

    return new BeaconError({
      code: "NOT_STARTED",
      message: "An operation needs a started Beacon.",
    });
  }
}

const SUPERSEDED_OUTCOME: CheckOutcome = Object.freeze({
  status: "superseded",
});

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
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteHandle } from "src/types/RouteHandle";
import type { RunningApplication } from "src/types/RunningApplication";
import { BeaconError } from "src/utils/BeaconError";
import {
  DEFAULT_CHECK_TIMEOUT,
  DEFAULT_RUNNING_TIMEOUT,
  DEFAULT_SETTLEMENT_TIMEOUT,
} from "src/utils/constants/defaults";
import { CommandCoordinator } from "src/utils/internal/commands/CommandCoordinator";
import { DisruptionRegistry } from "src/utils/internal/disruptions/DisruptionRegistry";
import { createSystemClock } from "src/utils/internal/clock/createSystemClock";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";
import { createDisposedError } from "src/utils/internal/errors/createDisposedError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";
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
  #commands: CommandCoordinator;
  #diagnostics: Diagnostics;
  #names: Array<keyof TRoutes & string>;
  #handles: {
    [TName in keyof TRoutes & string]: RouteHandle<TName, TRoutes[TName]>;
  };

  #initialReads: Promise<void> = Promise.resolve();

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

    const frozenScope = Object.freeze({ ...scope });

    this.#routes = new RouteRegistry({
      definitions: routes,
      getScope: () => frozenScope,
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

    this.#commands = new CommandCoordinator({
      ledger: this.#routes.getLedger(),
      disruptions: this.#disruptions,
      getSession: () => this.#runtime.getSession(),
      createInactiveError: () => this.#createInactiveError(),
      record: this.#diagnostics.record,
    });

    this.#runtime = new BeaconRuntime({
      listeners: createListeners(),
      onStart: (session) => {
        this.#initialReads = this.#running.read(session);
        this.#routes.open(session);
      },
      onDispose: () => {
        this.#running.close();
        this.#commands.close();
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
    const outcomes = await Promise.all(
      this.#names.map((name) => this.#checkRoute(name, options)),
    );

    return {
      routes: mapNames(this.#names, (name) => {
        const index = this.#names.indexOf(name);

        return outcomes[index] ?? SUPERSEDED_OUTCOME;
      }),
      support: null,
    };
  };

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

    await this.#initialReads;

    if (!this.#isCurrent(session)) {
      return { status: "superseded" };
    }

    return this.#routes.check(session, name, {
      mode: options.mode ?? "join",
      signal: options.signal,
    });
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

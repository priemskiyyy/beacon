import type { BeaconDiagnostics } from "src/types/BeaconDiagnostics";
import type { BeaconOptions } from "src/types/BeaconOptions";
import type { BeaconStatus } from "src/types/BeaconStatus";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RunningApplication } from "src/types/RunningApplication";
import { DEFAULT_RUNNING_TIMEOUT } from "src/utils/constants/defaults";
import { createSystemClock } from "src/utils/internal/clock/createSystemClock";
import { Diagnostics } from "src/utils/internal/diagnostics/Diagnostics";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { resolveDuration } from "src/utils/internal/options/resolveDuration";
import { reportUnhandledError } from "src/utils/internal/reporting/reportUnhandledError";
import { BeaconRuntime } from "src/utils/internal/runtime/BeaconRuntime";
import { RunningRegistry } from "src/utils/internal/running/RunningRegistry";

/**
 * One application-owned model of release awareness. Constructing it, reading
 * it and subscribing to it start nothing; `start()` opens the observation
 * session, and `dispose()` ends it for good.
 *
 * @example
 * ```ts
 * const beacon = new Beacon({ running: { boot: { id: BOOT_ID }, web: readWebRelease } });
 * const stop = beacon.start();
 *
 * stop();
 * beacon.dispose();
 * ```
 */
export class Beacon {
  #runtime: BeaconRuntime;
  #running: RunningRegistry;
  #diagnostics: Diagnostics;

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

  constructor({
    running,
    timeouts = {},
    clock = createSystemClock(),
  }: BeaconOptions) {
    const runningTimeout = resolveDuration(
      "timeouts.running",
      timeouts.running,
      DEFAULT_RUNNING_TIMEOUT,
    );

    this.#diagnostics = new Diagnostics({
      clock,
      getSession: () => this.#runtime.getSession()?.id ?? null,
      collect: (counters) => ({
        status: this.#runtime.status.get().state,
        session: this.#runtime.getSession()?.id ?? null,
        counters,
      }),
    });

    const reportListenerError = (error: unknown) => {
      this.#diagnostics.record("listener-error");
      reportUnhandledError(error);
    };

    const reportCleanupError = (error: unknown) => {
      this.#diagnostics.record("cleanup-error");
      reportUnhandledError(error);
    };

    this.#running = new RunningRegistry({
      readers: running,
      clock,
      timeout: runningTimeout,
      listeners: new Listeners(reportListenerError),
      record: this.#diagnostics.record,
    });

    this.#runtime = new BeaconRuntime({
      listeners: new Listeners(reportListenerError),
      onStart: (session) => {
        this.#running.read(session);
      },
      onDispose: () => {
        this.#running.close();
        this.#diagnostics.record("disposed");
        this.#diagnostics.close();
      },
      record: this.#diagnostics.record,
      reportCleanupError,
    });

    this.status = this.#runtime.status;
    this.running = this.#running.state;
    this.diagnostics = this.#diagnostics.view;
  }

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
}

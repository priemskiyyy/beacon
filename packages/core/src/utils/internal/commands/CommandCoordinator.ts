import type { BeaconErrorCode } from "src/types/BeaconErrorCode";
import type { CommandParameters } from "src/types/CommandParameters";
import type { Lease } from "src/types/internal/Lease";
import type { CommandAdmission } from "src/types/internal/CommandAdmission";
import type { CommandCoordinatorOptions } from "src/types/internal/CommandCoordinatorOptions";
import type { CommandInput } from "src/types/internal/CommandInput";
import type { CommandOperation } from "src/types/internal/CommandOperation";
import type { CommandResult } from "src/types/internal/CommandResult";
import type { CommandResolution } from "src/types/internal/CommandResolution";
import type { CommandTarget } from "src/types/internal/CommandTarget";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { Session } from "src/types/internal/Session";
import type { OperationState } from "src/types/OperationState";
import type { ProviderResult } from "src/types/ProviderResult";
import { BeaconError } from "src/utils/BeaconError";
import {
  ABORTED_AFTER_DISPATCH,
  DISPATCH_UNCONFIRMED,
  OPERATION_INDETERMINATE,
  OPERATION_IN_PROGRESS,
  SAFETY_CHANGED,
} from "src/utils/constants/commands";
import { IDLE_OPERATION } from "src/utils/constants/routes";
import { describeImpacts } from "src/utils/internal/commands/describeImpacts";
import { readInput } from "src/utils/internal/commands/readInput";
import { readParameters } from "src/utils/internal/commands/readParameters";
import { resolveCommand } from "src/utils/internal/commands/resolveCommand";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { createDeferred } from "src/utils/internal/common/createDeferred";
import { isSameData } from "src/utils/internal/common/isSameData";
import { untilAborted } from "src/utils/internal/common/untilAborted";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import { commitChange } from "src/utils/internal/observable/commitChange";

type Admitted = Extract<CommandAdmission, { status: "admitted" }>;

type Stopped = { status: "stopped"; outcome: CommandResult };

/** Why the call stopped before the provider was asked, or what to dispatch. */
type Verdict =
  | {
      status: "ready";
      resolution: Extract<CommandResolution, { status: "resolved" }>;
      native: object;
    }
  | Stopped;

const stopWith = (outcome: CommandResult): Stopped => ({
  status: "stopped",
  outcome,
});

/**
 * Carries out the commands of every route, one at a time per route and one
 * disruptive command at a time across routes. A call takes its slot before it
 * asks any participant or provider, because either can call back into Beacon.
 * Then it reserves and settles the participants, revalidates, and dispatches
 * once. It never queues a conflicting call, and it never retries one.
 */
export class CommandCoordinator {
  #options: CommandCoordinatorOptions;
  #operations = new Map<string, CommandOperation>();
  #count = 0;
  // What a failed outcome's error was made from, by the outcome: only the event that reports the failure holds it, never the outcome.
  #thrown = new WeakMap<object, unknown>();

  constructor(options: CommandCoordinatorOptions) {
    this.#options = options;
  }

  /** Answers how the call settled; expected failures are outcomes, and it never rejects. */
  run = (
    target: CommandTarget,
    given: CommandInput | null = {},
  ): Promise<CommandResult> => {
    const input = readInput(given);
    const session = this.#options.getSession();

    if (session === null) {
      return Promise.resolve(
        this.#answer(target, {
          status: "failed",
          error: this.#options.createInactiveError(),
        }),
      );
    }

    const resolution = resolveCommand(
      target,
      this.#options.ledger,
      input,
      this.#options.now(),
    );

    if (resolution.status === "stale") {
      return Promise.resolve(this.#answer(target, resolution));
    }

    const parameters = readParameters(input);

    const admission = this.#admit(
      session,
      target,
      resolution.reference,
      parameters,
    );

    if (admission.status === "blocked") {
      return Promise.resolve(this.#answer(target, admission));
    }

    if (admission.status === "joined") {
      return this.#join(admission.operation, input.signal);
    }

    return this.#start(session, target, admission, input);
  };

  /**
   * Ends an unresolved operation of a route: its reservations are released and
   * the route accepts commands again. It claims nothing about what the
   * provider did, and a route with nothing unresolved is left alone.
   */
  acknowledge = (entry: RouteEntry) => {
    const operation = this.#operations.get(entry.name);

    if (operation === undefined || operation.phase !== "unresolved") {
      return;
    }

    this.#release(operation);
  };

  /** The name of a route whose operation is running or unresolved, or `undefined` when none is. */
  findBusy = () => this.#operations.keys().next().value;

  /** Ends every call still under way as a session that stops does, while the routes still take the state it leaves: what was asked of the provider is indeterminate, and the rest is released. */
  close = () => {
    for (const operation of [...this.#operations.values()]) {
      this.#end(operation);
    }
  };

  #admit(
    session: Session,
    { entry, name, command }: CommandTarget,
    reference: object | null,
    parameters: CommandParameters,
  ): CommandAdmission {
    const held = this.#operations.get(entry.name);

    if (held !== undefined && held.phase === "unresolved") {
      return this.#refuse(OPERATION_INDETERMINATE);
    }

    if (held !== undefined) {
      const isIdentical =
        held.command === name &&
        held.reference === reference &&
        isSameData(held.parameters, parameters);

      if (!isIdentical) {
        return this.#refuse(OPERATION_IN_PROGRESS);
      }

      return { status: "joined", operation: held };
    }

    const effects = describeImpacts(command.impacts);

    if (effects.disruptive && this.#hasDisruptive()) {
      return this.#refuse(OPERATION_IN_PROGRESS);
    }

    const deferred = createDeferred<CommandResult>();

    this.#count += 1;

    const operation: CommandOperation = {
      id: this.#count,
      session,
      entry,
      command: name,
      reference,
      parameters,
      disruptive: effects.disruptive,
      replacesRealm: effects.replacesRealm,
      phase: "running",
      lease: null,
      outcome: deferred.promise,
    };

    this.#operations.set(entry.name, operation);

    return { status: "admitted", operation, answer: deferred.resolve };
  }

  #refuse(code: string): CommandAdmission {
    return {
      status: "blocked",
      reasons: [{ code, participant: null }],
    };
  }

  #hasDisruptive() {
    return [...this.#operations.values()].some(
      (operation) => operation.disruptive,
    );
  }

  // Ends only this caller's wait; the operation it joined is not its own to abort.
  async #join(
    operation: CommandOperation,
    signal: AbortSignal | undefined,
  ): Promise<CommandResult> {
    if (signal === undefined) {
      return operation.outcome;
    }

    const raced = await untilAborted(operation.outcome, signal);

    if (raced.status === "aborted") {
      return { status: "cancelled", stage: "joined" };
    }

    return raced.value;
  }

  #start(
    session: Session,
    target: CommandTarget,
    { operation, answer }: Admitted,
    input: CommandInput,
  ): Promise<CommandResult> {
    this.#execute(session, target, operation, input).then((outcome) =>
      answer(this.#answer(target, outcome, operation)),
    );

    return operation.outcome;
  }

  async #execute(
    session: Session,
    target: CommandTarget,
    operation: CommandOperation,
    input: CommandInput,
  ): Promise<CommandResult> {
    const controller = new AbortController();

    let stopFollowing = () => {};

    try {
      stopFollowing = this.#follow(session, controller, input.signal);

      return await this.#coordinate(target, operation, input, controller);
    } catch (cause) {
      // Whatever throws here, the slot and the reservations are given back: a route never stays held by a call that is over.
      this.#release(operation);

      return this.#fail(cause, {
        code: "COMMAND_FAILED",
        message: "A command could not be carried out.",
      });
    } finally {
      stopFollowing();
    }
  }

  // The caller's signal and the end of the session both end the wait.
  #follow(
    session: Session,
    controller: AbortController,
    signal: AbortSignal | undefined,
  ) {
    const abort = () => controller.abort();

    if (signal === undefined) {
      return session.resources.add(abort);
    }

    if (signal.aborted) {
      abort();
    }

    signal.addEventListener("abort", abort, { once: true });

    const leaveSession = session.resources.add(abort);

    return () => {
      leaveSession();
      signal.removeEventListener("abort", abort);
    };
  }

  async #coordinate(
    target: CommandTarget,
    operation: CommandOperation,
    input: CommandInput,
    controller: AbortController,
  ): Promise<CommandResult> {
    const { entry, name } = target;

    this.#publish(entry, {
      state: "running",
      operation: { id: operation.id },
      command: name,
      progress: null,
    });
    this.#options.record("command-admitted", {
      route: entry.name,
      command: name,
      operation: operation.id,
    });

    const prepared = await this.#prepare(target, operation, input, controller);

    if (prepared.status === "stopped") {
      this.#release(operation);

      return prepared.outcome;
    }

    // The last look and the dispatch share one turn: nothing can interleave between them.
    const verdict = this.#revalidate(target, prepared.lease, input, controller);

    if (verdict.status === "stopped") {
      this.#release(operation);

      return verdict.outcome;
    }

    return this.#dispatch(operation, verdict, controller);
  }

  // Everything up to the last look: room is made, and the intent is written.
  async #prepare(
    target: CommandTarget,
    operation: CommandOperation,
    input: CommandInput,
    controller: AbortController,
  ): Promise<Stopped | { status: "prepared"; lease: Lease }> {
    // Nobody is asked to make room for a command that cannot run.
    const opened = this.#checkOpen(target, controller);

    if (opened.status === "stopped") {
      return opened;
    }

    const { entry, name, command } = target;

    const reservation = this.#options.disruptions.reserve({
      route: entry.name,
      command: name,
      impacts: command.impacts,
    });

    if (reservation.status === "blocked") {
      return stopWith({ status: "blocked", reasons: reservation.reasons });
    }

    const { lease } = reservation;

    operation.lease = lease;

    const settling = await untilAborted(
      lease.settle(controller.signal),
      controller.signal,
    );

    if (settling.status === "aborted") {
      return stopWith({ status: "cancelled", stage: "settling" });
    }

    if (settling.value.length > 0) {
      return stopWith({ status: "blocked", reasons: settling.value });
    }

    const stopped = await this.#writeIntent(
      target,
      operation,
      lease,
      input,
      controller,
    );

    if (stopped !== null) {
      return stopped;
    }

    return { status: "prepared", lease };
  }

  // A command that replaces the realm first looks again, then writes its intent, which takes time. The intent is not proof of a dispatch: it is what the next boot reads back to say what happened.
  async #writeIntent(
    target: CommandTarget,
    operation: CommandOperation,
    lease: Lease,
    input: CommandInput,
    controller: AbortController,
  ): Promise<Stopped | null> {
    if (!operation.replacesRealm) {
      return null;
    }

    const { entry, name, command } = target;
    const { subject } = entry;

    // The intent names what runs as the reader answered, however late, so a command issued as the session opened waits for it; a journal that is off writes nothing and nothing waits for it.
    if (this.#options.journal.state.get().journal !== "off") {
      const read = await untilAborted(
        this.#options.waitForRunning(operation.session, subject),
        controller.signal,
      );

      if (read.status === "aborted") {
        return stopWith({ status: "cancelled", stage: "journaling" });
      }
    }

    const first = this.#revalidate(target, lease, input, controller);

    if (first.status === "stopped") {
      return first;
    }

    const running = this.#options.getRunning();
    const fact = running[subject];

    const written = await untilAborted(
      this.#options.journal.write({
        operation: { id: operation.id },
        boot: { id: running.boot.id },
        route: entry.name,
        command: name,
        subject,
        current: fact.state === "known" ? fact.release.identity : null,
        target: first.resolution.target,
        binding: command.binding,
      }),
      controller.signal,
    );

    if (written.status === "aborted") {
      return stopWith({ status: "cancelled", stage: "journaling" });
    }

    if (written.value.status !== "failed") {
      return null;
    }

    const failed: CommandResult = {
      status: "failed",
      error: toErrorInfo(written.value.error),
    };

    this.#thrown.set(failed, written.value.error.cause);

    return stopWith(failed);
  }

  // What has to hold for any command to run: the caller still waits, and the provider is open.
  #checkOpen(
    { entry }: CommandTarget,
    controller: AbortController,
  ): Stopped | { status: "open"; native: object } {
    if (controller.signal.aborted) {
      return stopWith({ status: "cancelled", stage: "before-dispatch" });
    }

    const native = entry.record.native.get();

    if (native === null) {
      return stopWith({
        status: "failed",
        error: toErrorInfo(
          entry.record.getNotOpen() ??
            new BeaconError({
              code: "DRIVER_FAILED",
              message: "The provider is not open.",
            }),
        ),
      });
    }

    return { status: "open", native };
  }

  // Everything the call assumed when it was admitted is looked at again, right before the provider is asked.
  #revalidate(
    target: CommandTarget,
    lease: Lease,
    input: CommandInput,
    controller: AbortController,
  ): Verdict {
    const opened = this.#checkOpen(target, controller);

    if (opened.status === "stopped") {
      return opened;
    }

    const resolution = resolveCommand(
      target,
      this.#options.ledger,
      input,
      this.#options.now(),
    );

    if (resolution.status === "stale") {
      return stopWith(resolution);
    }

    if (this.#options.disruptions.getRevision() !== lease.revision) {
      return stopWith({
        status: "blocked",
        reasons: [{ code: SAFETY_CHANGED, participant: null }],
      });
    }

    return { status: "ready", resolution, native: opened.native };
  }

  async #dispatch(
    operation: CommandOperation,
    { resolution, native }: Extract<Verdict, { status: "ready" }>,
    controller: AbortController,
  ): Promise<CommandResult> {
    operation.phase = "dispatched";

    const dispatched = this.#call(() =>
      resolution.invoke({
        native,
        signal: controller.signal,
        parameters: operation.parameters,
      }),
    ).then((result) => this.#finish(operation, result));

    const raced = await untilAborted(dispatched, controller.signal);

    if (raced.status === "settled") {
      return raced.value;
    }

    // The caller stopped waiting after the provider was asked: whether it took effect is not known.
    this.#hold(operation, ABORTED_AFTER_DISPATCH);

    return {
      status: "indeterminate",
      operation: { id: operation.id },
      reason: ABORTED_AFTER_DISPATCH,
    };
  }

  // A command that throws did not take effect; one that might have says so with `indeterminate`.
  async #call(
    invoke: () => Promise<ProviderResult<{ kind: string }>>,
  ): Promise<ProviderResult<{ kind: string }>> {
    try {
      return await invoke();
    } catch (cause) {
      return this.#fail(cause, {
        code: "COMMAND_FAILED",
        message: "A command failed.",
      });
    }
  }

  // A thrown value becomes a failed outcome with its code and message alone, and is remembered for the diagnostics.
  #fail(cause: unknown, fallback: { code: BeaconErrorCode; message: string }) {
    const outcome: Extract<CommandResult, { status: "failed" }> = {
      status: "failed",
      error: toErrorInfo(toBeaconError(cause, fallback)),
    };

    this.#thrown.set(outcome, cause);

    return outcome;
  }

  // What the provider reported decides whether the reservations are released or stay held.
  #finish(
    operation: CommandOperation,
    result: ProviderResult<{ kind: string }>,
  ): CommandResult {
    if (result.status === "accepted") {
      if (operation.replacesRealm) {
        this.#hold(operation, DISPATCH_UNCONFIRMED);
      } else {
        this.#release(operation);
      }

      return {
        status: "accepted",
        operation: { id: operation.id },
        receipt: result.receipt,
      };
    }

    if (result.status === "indeterminate") {
      this.#hold(operation, result.reason);

      return {
        status: "indeterminate",
        operation: { id: operation.id },
        reason: result.reason,
      };
    }

    this.#release(operation);

    if (result.status === "stale") {
      return { status: "stale", reason: "provider-changed" };
    }

    if (result.status === "unsupported") {
      return result;
    }

    if (result.status === "cancelled") {
      return result;
    }

    if (result.status === "failed") {
      return result;
    }

    return assertUnreachable(result);
  }

  // The operation stays, with its reservations, until the application acknowledges it.
  #hold(operation: CommandOperation, reason: string) {
    if (this.#operations.get(operation.entry.name) !== operation) {
      return;
    }

    operation.phase = "unresolved";
    this.#publish(operation.entry, {
      state: "indeterminate",
      operation: { id: operation.id },
      command: operation.command,
      reason,
    });
  }

  #release(operation: CommandOperation) {
    const { entry } = operation;

    if (this.#operations.get(entry.name) === operation) {
      this.#operations.delete(entry.name);
    }

    this.#releaseLease(operation);

    // A release can call back into Beacon and start the next command, whose state stands.
    if (this.#operations.has(entry.name)) {
      return;
    }

    this.#publish(entry, IDLE_OPERATION);
  }

  #end(operation: CommandOperation) {
    // What was never confirmed stays unconfirmed in the last snapshot: only the reservations go.
    if (operation.phase === "dispatched") {
      this.#hold(operation, ABORTED_AFTER_DISPATCH);
    } else if (operation.phase === "running") {
      this.#release(operation);
    }

    this.#releaseLease(operation);
  }

  #releaseLease(operation: CommandOperation) {
    const { lease } = operation;

    operation.lease = null;
    lease?.release();
  }

  #publish(entry: RouteEntry, operation: OperationState) {
    commitChange((transaction) =>
      entry.record.installOperation(transaction, operation),
    );
  }

  // Records how a call ended, and hands the outcome back.
  #answer(
    { entry, name }: CommandTarget,
    outcome: CommandResult,
    operation?: CommandOperation,
  ): CommandResult {
    this.#options.record("command-settled", {
      route: entry.name,
      command: name,
      reason: outcome.status,
      operation: operation?.id,
      cause: this.#thrown.get(outcome),
    });

    return outcome;
  }
}

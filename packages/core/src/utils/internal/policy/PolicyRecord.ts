import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { ErasedPolicy } from "src/types/internal/ErasedPolicy";
import type { PolicyEvaluation } from "src/types/internal/PolicyEvaluation";
import type { PolicyRecordOptions } from "src/types/internal/PolicyRecordOptions";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RunningApplication } from "src/types/RunningApplication";
import type { SupportEvaluation } from "src/types/SupportEvaluation";
import type { SupportState } from "src/types/SupportState";
import { BeaconError } from "src/utils/BeaconError";
import {
  NO_POLICY_SUPPORT,
  NOT_CHECKED_SUPPORT,
} from "src/utils/constants/support";
import { freezeList } from "src/utils/internal/common/freezeList";
import { isSameData } from "src/utils/internal/common/isSameData";
import { hasLapsed } from "src/utils/internal/feeds/hasLapsed";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { ValueStore } from "src/utils/internal/observable/ValueStore";

/** An evaluation and what it was made from: the same accepted feed and running revision are not evaluated again. */
type Held = {
  accepted: AcceptedFeed;
  runningRevision: number;
} & PolicyEvaluation;

type Reached = Extract<Held, { status: "evaluated" }>;

/**
 * Owns the published support state. It evaluates the policy from the accepted
 * document and the running facts, keeps the last valid evaluation beside a
 * failure or a lapse, and runs the application's function again only when the
 * accepted document, its evidence included, or the running facts changed. A
 * state that means the same as the last keeps its snapshot, so a change to a
 * fact the verdict does not depend on resets no gate.
 */
export class PolicyRecord {
  #options: PolicyRecordOptions;
  #store: ValueStore<SupportState>;
  #unchecked: SupportState;
  #held: Held | null = null;
  #lastValid: Reached | null = null;

  state: ObservableValue<SupportState>;

  constructor(options: PolicyRecordOptions) {
    this.#options = options;

    this.#unchecked =
      options.policy === null ? NO_POLICY_SUPPORT : NOT_CHECKED_SUPPORT;
    this.#store = new ValueStore<SupportState>(
      this.#unchecked,
      options.listeners,
    );
    this.state = this.#store.observable;
  }

  /** Evaluates again where the document, the running facts or a route changed, and installs what it means. */
  update = (
    transaction: Transaction,
    accepted: AcceptedFeed | null,
    running: RunningApplication,
  ) => {
    const { policy } = this.#options;

    if (policy === null || accepted === null) {
      return;
    }

    const held = this.#evaluate(policy, accepted, running);

    this.#install(transaction, this.#toState(held));
  };

  /** Forgets every evaluation, as a policy of another scope says nothing about this one. */
  reset = (transaction: Transaction) => {
    this.#held = null;
    this.#lastValid = null;
    this.#install(transaction, this.#unchecked);
  };

  /** The last evaluation failed, or `null`. */
  getFailure = () => {
    if (this.#held?.status !== "failed") {
      return null;
    }

    return this.#held.error;
  };

  close = () => {
    this.#store.close();
  };

  // A failure is reported when it is made, so once, however often it is read again.
  #evaluate(
    policy: ErasedPolicy,
    accepted: AcceptedFeed,
    running: RunningApplication,
  ): Held {
    const held = this.#held;

    if (
      held !== null &&
      held.accepted === accepted &&
      held.runningRevision === running.revision
    ) {
      return held;
    }

    const next: Held = {
      accepted,
      runningRevision: running.revision,
      ...this.#run(policy, accepted.document, running),
    };

    this.#held = next;

    if (next.status === "failed") {
      this.#options.onFailure(next.error);

      return next;
    }

    this.#lastValid = next;

    return next;
  }

  // The verdict is the application's, and it may change it later: what is kept is a copy, and an answer that is not a verdict fails here.
  #run(
    policy: ErasedPolicy,
    document: unknown,
    running: RunningApplication,
  ): PolicyEvaluation {
    const { getRoute } = this.#options;

    try {
      const verdict = policy.evaluate(policy.source.project(document), running);

      const reasons = freezeList(
        verdict.reasons.map((reason) => Object.freeze({ ...reason })),
      );

      const remediation = freezeList(
        verdict.remediation.map(({ route, level }) =>
          Object.freeze({ route, level }),
        ),
      );

      const unknown = remediation.find(
        ({ route }) => getRoute(route) === undefined,
      );

      if (unknown !== undefined) {
        return {
          status: "failed",
          error: new BeaconError({
            code: "POLICY_FAILED",
            message: `The support policy names the route "${unknown.route}", which is not configured.`,
          }),
        };
      }

      return {
        status: "evaluated",
        verdict: { status: verdict.status, reasons, remediation },
      };
    } catch (cause) {
      return {
        status: "failed",
        error: toBeaconError(cause, {
          code: "POLICY_FAILED",
          message: "The support policy could not be evaluated.",
        }),
      };
    }
  }

  #install(transaction: Transaction, state: SupportState) {
    const current = this.#store.get();

    if (isSameData(this.#normalize(state), this.#normalize(current))) {
      return;
    }

    transaction.set(
      this.#store,
      Object.freeze({ ...state, revision: current.revision + 1 }),
    );
  }

  // The revisions only say when a verdict was reached: the same verdict later is the same state.
  #normalize(state: SupportState) {
    return {
      ...state,
      revision: 0,
      evaluation:
        state.evaluation === null
          ? null
          : { ...state.evaluation, evaluatedRunningRevision: 0 },
    };
  }

  // A failure keeps the last valid evaluation in force while its policy still holds, and says what failed beside it.
  #toState(held: Held): SupportState {
    if (held.status === "evaluated") {
      return this.#toInForce(held, null);
    }

    const error = toErrorInfo(held.error);

    if (this.#lastValid === null) {
      return {
        revision: 0,
        status: "unknown",
        reason: "evaluation-failed",
        evaluation: null,
        error,
      };
    }

    return this.#toInForce(this.#lastValid, error);
  }

  // A policy whose evidence lapsed is unknown, with its last decision retained. The freshness recorded with an evaluation is as old as the evaluation, so the clock decides for one that is kept.
  #toInForce(reached: Reached, error: SupportState["error"]): SupportState {
    const evaluation = this.#describe(reached);

    if (hasLapsed(evaluation.evidence, this.#options.now())) {
      return {
        revision: 0,
        status: "unknown",
        reason: "expired",
        evaluation,
        error,
      };
    }

    return {
      revision: 0,
      status: evaluation.status,
      reason: null,
      evaluation,
      error,
    };
  }

  // Whether a route is usable is what it is now, also for an evaluation that was made earlier.
  #describe({
    accepted,
    runningRevision,
    verdict,
  }: Reached): SupportEvaluation {
    return Object.freeze({
      status: verdict.status,
      reasons: verdict.reasons,
      remediation: freezeList(
        verdict.remediation.map(({ route, level }) =>
          Object.freeze({ route, level, usable: this.#isUsable(route) }),
        ),
      ),
      evaluatedRunningRevision: runningRevision,
      evidence: accepted.evidence,
    });
  }

  // A route is usable when it has an offer to act on or a prepared target to finish.
  #isUsable(route: string) {
    const state = this.#options.getRoute(route);

    return (
      state?.observation.status === "available" ||
      state?.prepared.status === "ready"
    );
  }
}

import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { ErasedPolicy } from "src/types/internal/ErasedPolicy";
import type { PolicyEvaluation } from "src/types/internal/PolicyEvaluation";
import type { PolicyRecordOptions } from "src/types/internal/PolicyRecordOptions";
import type { ObservableValue } from "src/types/ObservableValue";
import type { RemediationState } from "src/types/RemediationState";
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
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { ValueStore } from "src/utils/internal/observable/ValueStore";

type Held = {
  accepted: AcceptedFeed;
  runningRevision: number;
  evaluation: PolicyEvaluation;
};

/**
 * Owns the published support state. It evaluates the policy from the accepted
 * document and the running facts, keeps the last valid evaluation beside a
 * failure or a lapse, and runs the application's function again only when the
 * document or the running facts changed. A state that means the same as the
 * last keeps its snapshot, so a change to a fact the verdict does not depend
 * on resets no gate.
 */
export class PolicyRecord {
  #options: PolicyRecordOptions;
  #store: ValueStore<SupportState>;
  #held: Held | null = null;
  #lastValid: SupportEvaluation | null = null;
  #reported: BeaconError | null = null;

  state: ObservableValue<SupportState>;

  constructor(options: PolicyRecordOptions) {
    this.#options = options;

    this.#store = new ValueStore<SupportState>(
      options.policy === null ? NO_POLICY_SUPPORT : NOT_CHECKED_SUPPORT,
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

    if (held.evaluation.status === "failed") {
      this.#report(held.evaluation.error);
    } else {
      this.#reported = null;
    }

    this.#install(transaction, held);
  };

  /** Forgets every evaluation, as a policy of another scope says nothing about this one. */
  reset = (transaction: Transaction) => {
    this.#held = null;
    this.#lastValid = null;
    this.#reported = null;

    transaction.set(
      this.#store,
      this.#options.policy === null ? NO_POLICY_SUPPORT : NOT_CHECKED_SUPPORT,
    );
  };

  /** The last evaluation failed, or `null`. */
  getFailure = () => {
    if (this.#held?.evaluation.status !== "failed") {
      return null;
    }

    return this.#held.evaluation.error;
  };

  close = () => {
    this.#store.close();
  };

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

    this.#held = {
      accepted,
      runningRevision: running.revision,
      evaluation: this.#run(policy, accepted.document, running),
    };

    return this.#held;
  }

  #run(
    policy: ErasedPolicy,
    document: unknown,
    running: RunningApplication,
  ): PolicyEvaluation {
    const { getRoute } = this.#options;

    try {
      const verdict = policy.evaluate(policy.source.project(document), running);

      const unknown = verdict.remediation.find(
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

      return { status: "evaluated", verdict };
    } catch (cause) {
      return { status: "failed", error: this.#createError(cause) };
    }
  }

  #createError(cause: unknown) {
    return toBeaconError(cause, {
      code: "POLICY_FAILED",
      message: "The support policy could not be evaluated.",
    });
  }

  #report(error: BeaconError) {
    if (this.#reported === error) {
      return;
    }

    this.#reported = error;
    this.#options.onFailure(error);
  }

  #install(transaction: Transaction, held: Held) {
    const state = this.#toState(held);
    const current = this.#store.get();

    const same = isSameData(this.#normalize(state), this.#normalize(current));

    if (same) {
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

  #toState({ accepted, runningRevision, evaluation }: Held): SupportState {
    if (evaluation.status === "failed") {
      return this.#toFailedState(evaluation.error);
    }

    const { verdict } = evaluation;

    const evaluated: SupportEvaluation = Object.freeze({
      status: verdict.status,
      reasons: freezeList(
        verdict.reasons.map((reason) => Object.freeze({ ...reason })),
      ),
      remediation: freezeList(this.#toRemediation(verdict.remediation)),
      evaluatedRunningRevision: runningRevision,
      evidence: accepted.evidence,
    });

    this.#lastValid = evaluated;

    return this.#toInForce(evaluated, null);
  }

  // A failure keeps the last valid evaluation in force while its policy still holds, and says what failed beside it.
  #toFailedState(error: BeaconError): SupportState {
    const info = toErrorInfo(error);

    if (this.#lastValid === null) {
      return {
        revision: 0,
        status: "unknown",
        reason: "evaluation-failed",
        evaluation: null,
        error: info,
      };
    }

    return this.#toInForce(this.#lastValid, info);
  }

  // A policy whose evidence lapsed is unknown, with its last decision retained.
  #toInForce(
    evaluation: SupportEvaluation,
    error: SupportState["error"],
  ): SupportState {
    if (evaluation.evidence.freshness === "expired") {
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

  #toRemediation(
    remediation: Array<{ route: string; level: RemediationState["level"] }>,
  ): RemediationState[] {
    return remediation.map(({ route, level }) =>
      Object.freeze({
        route,
        level,
        usable: this.#isUsable(route),
      }),
    );
  }

  // A route is usable when it has an offer to act on or a prepared target to finish.
  #isUsable(route: string) {
    const state = this.#options.getRoute(route);

    if (state === undefined) {
      return false;
    }

    return (
      state.observation.status === "available" ||
      state.prepared.status === "ready"
    );
  }
}

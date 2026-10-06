import type { BeaconClock } from "src/types/BeaconClock";
import type { CheckState } from "src/types/CheckState";
import type { Evidence } from "src/types/Evidence";
import type { RouteState } from "src/types/internal/RouteState";
import type { Observation } from "src/types/Observation";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { Offer } from "src/types/Offer";
import type { ObservableValue } from "src/types/ObservableValue";
import type { OperationState } from "src/types/OperationState";
import type { Prepared } from "src/types/Prepared";
import type { PreparedDraft } from "src/types/PreparedDraft";
import type { PreparedState } from "src/types/PreparedState";
import type { Release } from "src/types/Release";
import type { ReleaseSelection } from "src/types/ReleaseSelection";
import type { RouteBody } from "src/types/RouteBody";
import type { BeaconError } from "src/utils/BeaconError";
import { IDLE_OPERATION, IDLE_CHECK } from "src/utils/constants/routes";
import { assertUnreachable } from "src/utils/internal/common/assertUnreachable";
import { isSameData } from "src/utils/internal/common/isSameData";
import { toErrorInfo } from "src/utils/internal/errors/toErrorInfo";
import type { Listeners } from "src/utils/internal/observable/Listeners";
import type { Transaction } from "src/utils/internal/observable/Transaction";
import { ValueStore } from "src/utils/internal/observable/ValueStore";
import type { ReferenceLedger } from "src/utils/internal/routes/ReferenceLedger";
import { isSameRelease } from "src/utils/internal/routes/isSameRelease";

type RouteRecordOptions = {
  name: string;
  /** Whether the provider can report a prepared target at all. */
  prepares: boolean;
  ledger: ReferenceLedger;
  clock: BeaconClock;
  /** Makes the listeners of one observable, so each store reports its listeners' errors. */
  createListeners: () => Listeners;
};

type Body = RouteBody;

/**
 * Owns the published state of one route. Every install goes through the
 * transaction of the change it belongs to, so the route, the root and the
 * support policy all become visible together, and an install that changes
 * nothing keeps the snapshot.
 */
export class RouteRecord {
  #name: string;
  #initial: RouteState;
  #ledger: ReferenceLedger;
  #clock: BeaconClock;
  #store: ValueStore<RouteState>;
  #native: ValueStore<object | null>;

  state: ObservableValue<RouteState>;
  native: ObservableValue<object | null>;

  constructor({
    name,
    prepares,
    ledger,
    clock,
    createListeners,
  }: RouteRecordOptions) {
    this.#name = name;
    this.#ledger = ledger;
    this.#clock = clock;

    const prepared: PreparedState<string, Body> = prepares
      ? { status: "unknown" }
      : { status: "not-applicable" };

    this.#initial = Object.freeze({
      revision: 0,
      check: IDLE_CHECK,
      observation: Object.freeze({
        status: "unknown",
        reason: "not-checked",
      }),
      prepared: Object.freeze(prepared),
      operation: IDLE_OPERATION,
    });

    this.#store = new ValueStore<RouteState>(this.#initial, createListeners());
    this.#native = new ValueStore<object | null>(null, createListeners());
    this.state = this.#store.observable;
    this.native = this.#native.observable;
  }

  /** The offer the route holds now, or `null`. */
  getOffer = (): Offer<string, Body> | null => {
    const { observation } = this.#store.get();

    if (observation.status !== "available") {
      return null;
    }

    return observation.offer;
  };

  /** The prepared target the route holds now, or `null`. */
  getPrepared = (): Prepared<string, Body> | null => {
    const { prepared } = this.#store.get();

    if (prepared.status !== "ready") {
      return null;
    }

    return prepared.value;
  };

  beginCheck = (transaction: Transaction, attempt: number) => {
    this.#apply(transaction, {
      check: Object.freeze({
        state: "checking",
        attempt,
        startedAt: this.#clock.now(),
      }),
    });
  };

  /**
   * Ends the attempt that is checking; an error fails it and the observation
   * stays. Selecting again from the document that attempt accepted, as a
   * running fact does when it changes, settles it again: a selection that
   * starts to throw fails it, and one that works again clears the failure.
   */
  settleCheck = (
    transaction: Transaction,
    attempt: number,
    error: BeaconError | null,
  ) => {
    const { check } = this.#store.get();

    if (check.state === "idle" || check.attempt !== attempt) {
      return;
    }

    const times = {
      attempt,
      startedAt: check.startedAt,
      settledAt: this.#clock.now(),
    };

    const settled: CheckState =
      error === null
        ? { state: "succeeded", ...times }
        : { state: "failed", ...times, error: toErrorInfo(error) };

    if (
      check.state !== "checking" &&
      isSameData({ ...check, settledAt: 0 }, { ...settled, settledAt: 0 })
    ) {
      return;
    }

    this.#apply(transaction, { check: Object.freeze(settled) });
  };

  installSelection = (
    transaction: Transaction,
    selection: ReleaseSelection<Release<object | null>>,
    evidence: Evidence,
  ) => {
    if (selection.status === "offer") {
      this.#install(
        transaction,
        this.#available({ release: selection.release }, evidence),
      );

      return;
    }

    if (selection.status === "none") {
      this.#install(transaction, {
        status: "none",
        evidence,
        reason: selection.reason,
        detail: selection.detail,
        candidate: selection.candidate,
      });

      return;
    }

    if (selection.status === "inconclusive") {
      this.#install(transaction, {
        status: "inconclusive",
        evidence,
        reason: selection.reason,
        candidate: selection.candidate,
      });

      return;
    }

    assertUnreachable(selection);
  };

  installDraft = (
    transaction: Transaction,
    draft: ObservationDraft<Body>,
    evidence: Evidence,
  ) => {
    if (draft.status === "unknown") {
      this.#install(transaction, { status: "unknown", reason: draft.reason });

      return;
    }

    if (draft.status === "none") {
      this.#install(transaction, {
        status: "none",
        evidence,
        reason: draft.reason,
        detail: draft.detail,
        candidate: null,
      });

      return;
    }

    if (draft.status === "available") {
      this.#install(transaction, this.#available(draft.offer, evidence));

      return;
    }

    if (draft.status === "inconclusive") {
      this.#install(transaction, {
        status: "inconclusive",
        evidence,
        reason: draft.reason,
        candidate: null,
      });

      return;
    }

    assertUnreachable(draft);
  };

  /** Replaces the evidence behind the observation, as a renewal or an expiry does, and nothing else. */
  installEvidence = (transaction: Transaction, evidence: Evidence) => {
    const { observation } = this.#store.get();

    if (observation.status === "unknown") {
      return;
    }

    this.#install(transaction, { ...observation, evidence });
  };

  installPrepared = (transaction: Transaction, draft: PreparedDraft<Body>) => {
    const observedAt = this.#clock.now();

    if (draft.status === "none") {
      this.#apply(transaction, {
        prepared: Object.freeze({ status: "none", observedAt }),
      });

      return;
    }

    const ref = this.#keepOrMintPrepared(
      this.getPrepared(),
      draft.value.release,
    );

    const value = Object.freeze({ ref, ...draft.value });

    this.#apply(transaction, {
      prepared: Object.freeze({ status: "ready", value, observedAt }),
    });
  };

  installOperation = (transaction: Transaction, operation: OperationState) => {
    this.#apply(transaction, { operation });
  };

  /** Moves the progress of the running operation; a report with no operation running is dropped. */
  installProgress = (transaction: Transaction, fraction: number | null) => {
    const { operation } = this.#store.get();

    if (operation.state !== "running") {
      return;
    }

    this.#apply(transaction, {
      operation: Object.freeze({ ...operation, progress: fraction }),
    });
  };

  installNative = (transaction: Transaction, native: object | null) => {
    transaction.set(this.#native, native);
  };

  /** Goes back to knowing nothing, as a route does that has never been checked; the references it minted no longer match anything. */
  reset = (transaction: Transaction) => {
    const held = this.#store.get();

    // A route that learned nothing has nothing to forget, and its listeners hear nothing.
    if (
      isSameData({ ...held, revision: 0 }, { ...this.#initial, revision: 0 })
    ) {
      return;
    }

    transaction.set(
      this.#store,
      Object.freeze({ ...this.#initial, revision: held.revision + 1 }),
    );
  };

  close = () => {
    this.#store.close();
    this.#native.close();
  };

  #keepOrMintPrepared(
    held: Prepared<string, Body> | null,
    release: Release<object | null>,
  ) {
    if (held !== null && isSameRelease(held.release, release)) {
      return held.ref;
    }

    return this.#ledger.mintPrepared(this.#name);
  }

  #keepOrMintOffer(
    held: Offer<string, Body> | null,
    release: Release<object | null>,
  ) {
    if (held !== null && isSameRelease(held.release, release)) {
      return held.ref;
    }

    return this.#ledger.mintOffer(this.#name);
  }

  // A release that is the same keeps its reference, so an offer refreshed by a renewal is still the one the user was shown.
  #available(body: Body, evidence: Evidence): Observation<string, Body> {
    const ref = this.#keepOrMintOffer(this.getOffer(), body.release);

    return {
      status: "available",
      evidence,
      offer: Object.freeze({ ref, ...body }),
    };
  }

  #install(transaction: Transaction, observation: Observation<string, Body>) {
    const held = this.#store.get().observation;

    if (isSameData(held, observation)) {
      return;
    }

    this.#apply(transaction, { observation: Object.freeze(observation) });
  }

  #apply(
    transaction: Transaction,
    patch: Partial<Omit<RouteState, "revision">>,
  ) {
    const held = this.#store.get();

    const next = {
      check: patch.check ?? held.check,
      observation: patch.observation ?? held.observation,
      prepared: patch.prepared ?? held.prepared,
      operation: patch.operation ?? held.operation,
    };

    if (
      next.check === held.check &&
      next.observation === held.observation &&
      next.prepared === held.prepared &&
      next.operation === held.operation
    ) {
      return;
    }

    transaction.set(
      this.#store,
      Object.freeze({ revision: held.revision + 1, ...next }),
    );
  }
}

import type { BeaconClock } from "src/types/BeaconClock";
import type { CheckState } from "src/types/CheckState";
import type { Evidence } from "src/types/Evidence";
import type { RouteState } from "src/types/internal/RouteState";
import type { Observation } from "src/types/Observation";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { ObservableValue } from "src/types/ObservableValue";
import type { OperationState } from "src/types/OperationState";
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
  #initial: Omit<RouteState, "revision">;
  #ledger: ReferenceLedger;
  #clock: BeaconClock;
  #store: ValueStore<RouteState>;
  #native: ValueStore<object | null>;
  #notOpen: BeaconError | null = null;

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

    this.#initial = {
      check: IDLE_CHECK,
      observation: Object.freeze({
        status: "unknown",
        reason: "not-checked",
      }),
      prepared: Object.freeze(prepared),
      operation: IDLE_OPERATION,
    };

    this.#store = new ValueStore<RouteState>(
      Object.freeze({ revision: 0, ...this.#initial }),
      createListeners(),
    );
    this.#native = new ValueStore<object | null>(null, createListeners());
    this.state = this.#store.observable;
    this.native = this.#native.observable;
  }

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
        detail: selection.detail,
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

    assertUnreachable(draft);
  };

  installPrepared = (transaction: Transaction, draft: PreparedDraft<Body>) => {
    const observedAt = this.#clock.now();

    if (draft.status === "none") {
      this.#apply(transaction, {
        prepared: Object.freeze({ status: "none", observedAt }),
      });

      return;
    }

    const { prepared } = this.#store.get();

    const ref = this.#keepOr(
      prepared.status === "ready" ? prepared.value : null,
      draft.value.release,
      () => this.#ledger.mintPrepared(this.#name),
    );

    const value = Object.freeze({ ...draft.value, ref });

    this.#apply(transaction, {
      prepared: Object.freeze({ status: "ready", value, observedAt }),
    });
  };

  /** What is published is a snapshot nobody can change, its operation id included. */
  installOperation = (transaction: Transaction, operation: OperationState) => {
    if (operation.state === "idle") {
      this.#apply(transaction, { operation });

      return;
    }

    this.#apply(transaction, {
      operation: Object.freeze({
        ...operation,
        operation: Object.freeze({ ...operation.operation }),
      }),
    });
  };

  /** Moves the progress of the running operation; a report with no operation running is dropped, and one that is no fraction between 0 and 1 says the provider cannot tell. */
  installProgress = (transaction: Transaction, fraction: number | null) => {
    const { operation } = this.#store.get();

    if (operation.state !== "running") {
      return;
    }

    const isFraction =
      fraction !== null &&
      Number.isFinite(fraction) &&
      fraction >= 0 &&
      fraction <= 1;

    this.#apply(transaction, {
      operation: Object.freeze({
        ...operation,
        progress: isFraction ? fraction : null,
      }),
    });
  };

  installNative = (transaction: Transaction, native: object | null) => {
    transaction.set(this.#native, native);
  };

  /** Why the provider or the mechanism of this route did not open in this session, for a check or a command that finds it closed; `null` while it is open or was not asked to open. */
  getNotOpen = () => this.#notOpen;

  setNotOpen = (error: BeaconError | null) => {
    this.#notOpen = error;
  };

  /** Goes back to knowing nothing, as a route does that has never been checked; the references it minted no longer match anything. */
  reset = (transaction: Transaction) => {
    this.#apply(transaction, this.#initial);
  };

  close = () => {
    this.#store.close();
    this.#native.close();
  };

  // A release that is the same keeps its reference, so what a renewal refreshes is still what the user was shown.
  #keepOr<TReference>(
    held: { ref: TReference; release: Release<object | null> } | null,
    release: Release<object | null>,
    mint: () => TReference,
  ) {
    if (held !== null && isSameRelease(held.release, release)) {
      return held.ref;
    }

    return mint();
  }

  #available(body: Body, evidence: Evidence): Observation<string, Body> {
    const { observation } = this.#store.get();

    const ref = this.#keepOr(
      observation.status === "available" ? observation.offer : null,
      body.release,
      () => this.#ledger.mintOffer(this.#name),
    );

    return {
      status: "available",
      evidence,
      offer: Object.freeze({ ...body, ref }),
    };
  }

  #install(transaction: Transaction, observation: Observation<string, Body>) {
    this.#apply(transaction, { observation: Object.freeze(observation) });
  }

  // A patch that changes no dimension keeps the snapshot, its revision and its listeners' peace.
  #apply(
    transaction: Transaction,
    patch: Partial<Omit<RouteState, "revision">>,
  ) {
    const held = this.#store.get();
    const next = { ...held, ...patch };

    if (isSameData(next, held)) {
      return;
    }

    transaction.set(
      this.#store,
      Object.freeze({ ...next, revision: held.revision + 1 }),
    );
  }
}

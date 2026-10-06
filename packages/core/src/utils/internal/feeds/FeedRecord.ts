import type { BeaconClock } from "src/types/BeaconClock";
import type { Evidence } from "src/types/Evidence";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { FeedFlight } from "src/types/internal/FeedFlight";
import type { FeedHooks } from "src/types/internal/FeedHooks";
import type { FeedResult } from "src/types/internal/FeedResult";
import type {
  FeedWaiter,
  FeedWaiterGroup,
} from "src/types/internal/FeedWaiter";
import type { Session } from "src/types/internal/Session";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { SourceRead } from "src/types/SourceRead";
import { BeaconError } from "src/utils/BeaconError";
import { REVISION_MESSAGES } from "src/utils/constants/revisions";
import { CANONICAL_DECIMAL_PATTERN } from "src/utils/constants/versions";
import { toBeaconError } from "src/utils/internal/errors/toBeaconError";
import { createEvidence } from "src/utils/internal/feeds/createEvidence";
import { judgeRevision } from "src/utils/internal/revisions/judgeRevision";

type FeedRecordOptions = {
  source: ReleaseSource<unknown>;
  clock: BeaconClock;
  timeout: number;
  getScope: () => ReleaseScope;
  hooks: FeedHooks;
};

type ReadOptions = {
  mode: "join" | "after-current";
  signal: AbortSignal | undefined;
};

/**
 * Owns one source: the single read everyone shares, the document it accepted,
 * and the evidence behind it. A read answers only the session that started it,
 * and a caller's abort ends that caller's wait alone.
 */
export class FeedRecord {
  #source: ReleaseSource<unknown>;
  #clock: BeaconClock;
  #timeout: number;
  #getScope: () => ReleaseScope;
  #hooks: FeedHooks;
  #attempts = 0;
  #accepted: AcceptedFeed | null = null;
  #flight: FeedFlight | null = null;
  #trailing: FeedWaiterGroup | null = null;
  #cancelExpiry = () => {};

  constructor({ source, clock, timeout, getScope, hooks }: FeedRecordOptions) {
    this.#source = source;
    this.#clock = clock;
    this.#timeout = timeout;
    this.#getScope = getScope;
    this.#hooks = hooks;
  }

  /** The document the source last answered, or `null` before any. */
  getAccepted = () => this.#accepted;

  /** Reads the source, or joins the read in flight; resolves when this caller's read settled, and never rejects. */
  read = (session: Session, { mode, signal }: ReadOptions) =>
    new Promise<FeedResult>((resolve) => {
      if (!session.scope.isActive()) {
        resolve({ status: "superseded" });

        return;
      }

      if (signal !== undefined && signal.aborted) {
        resolve({ status: "cancelled" });

        return;
      }

      const { group, isNew } = this.#chooseGroup(mode);

      let detach = () => {};

      const waiter: FeedWaiter = {
        group,
        settle: (result) => {
          detach();
          resolve(result);
        },
      };

      group.waiters.add(waiter);

      if (signal !== undefined) {
        const handleAbort = () => this.#leave(waiter);

        signal.addEventListener("abort", handleAbort, { once: true });
        detach = () => signal.removeEventListener("abort", handleAbort);
      }

      if (!isNew) {
        return;
      }

      this.#startFlight(session, group);
    });

  /** Arms the expiry of a document held from an earlier session, or expires it if its time passed. */
  resume = (session: Session) => {
    const accepted = this.#accepted;

    if (accepted === null) {
      return;
    }

    this.#armExpiry(session, accepted);
  };

  #chooseGroup(mode: ReadOptions["mode"]) {
    const flight = this.#flight;

    if (flight === null) {
      return { group: { waiters: new Set<FeedWaiter>() }, isNew: true };
    }

    if (mode === "join") {
      return { group: flight.group, isNew: false };
    }

    if (this.#trailing === null) {
      this.#trailing = { waiters: new Set<FeedWaiter>() };
    }

    return { group: this.#trailing, isNew: false };
  }

  #startFlight(session: Session, group: FeedWaiterGroup) {
    this.#attempts += 1;

    const flight: FeedFlight = {
      attempt: this.#attempts,
      session,
      controller: new AbortController(),
      group,
      finished: false,
      release: () => {},
    };

    this.#flight = flight;

    const cancelTimeout = this.#clock.setTimer(() => {
      flight.controller.abort();
      this.#fail(
        flight,
        new BeaconError({
          code: "SOURCE_TIMEOUT",
          message: "A release source did not answer in time.",
        }),
      );
    }, this.#timeout);

    const removeCleanup = session.scope.add(() => this.#end(flight));

    flight.release = () => {
      cancelTimeout();
      removeCleanup();
    };

    this.#hooks.record("source-read-started", { attempt: flight.attempt });
    this.#hooks.started(flight.attempt);

    // A listener told about the start may have ended the session.
    if (flight.finished) {
      return;
    }

    new Promise<SourceRead<unknown>>((resolve) => {
      resolve(
        this.#source.read({
          scope: this.#getScope(),
          signal: flight.controller.signal,
          attempt: flight.attempt,
        }),
      );
    }).then(
      (read) => this.#handleRead(flight, read),
      (cause) =>
        this.#fail(
          flight,
          toBeaconError(cause, {
            code: "SOURCE_FAILED",
            message: "A release source could not be read.",
          }),
        ),
    );
  }

  #handleRead(flight: FeedFlight, read: SourceRead<unknown>) {
    if (flight.finished) {
      this.#hooks.record("late-callback", { reason: "source" });

      return;
    }

    let accepted: AcceptedFeed;
    let isRenewal: boolean;

    try {
      ({ accepted, isRenewal } = this.#judge(flight, read));
    } catch (cause) {
      this.#fail(
        flight,
        toBeaconError(cause, {
          code: "INVALID_DOCUMENT",
          message: "A release source answered a document Beacon cannot accept.",
        }),
      );

      return;
    }

    this.#finish(flight);
    this.#accepted = accepted;
    this.#armExpiry(flight.session, accepted);
    this.#hooks.record(
      isRenewal ? "source-read-renewed" : "source-read-accepted",
      { attempt: flight.attempt },
    );
    this.#hooks.accepted(accepted);
    this.#settle(flight.group, { status: "accepted", attempt: flight.attempt });
    this.#startTrailing(flight.session);
  }

  // Throws the error a rejected answer becomes; the held document is never touched here.
  #judge(flight: FeedFlight, read: SourceRead<unknown>) {
    const revision = read.revision ?? null;
    const claim = { revision, digest: read.digest ?? null };

    if (
      revision !== null &&
      revision.kind === "ordered" &&
      !CANONICAL_DECIMAL_PATTERN.test(revision.value)
    ) {
      throw new BeaconError({
        code: "INVALID_DOCUMENT",
        message: "An ordered decision revision must be a canonical decimal.",
      });
    }

    const verdict = judgeRevision(this.#accepted?.claim ?? null, claim);

    if (verdict.status === "rejected") {
      throw new BeaconError({
        code: verdict.code,
        message: REVISION_MESSAGES[verdict.code],
      });
    }

    const evidence = createEvidence({
      source: this.#source.name,
      origin: "network",
      receivedAt: this.#clock.now(),
      expiresAt: read.expiresAt ?? null,
      issuer: read.issuer ?? null,
      revision,
    });

    const accepted: AcceptedFeed = Object.freeze({
      document: read.document,
      claim: Object.freeze(claim),
      evidence,
      attempt: flight.attempt,
    });

    return { accepted, isRenewal: verdict.status === "renewed" };
  }

  #fail(flight: FeedFlight, error: BeaconError) {
    if (flight.finished) {
      this.#hooks.record("late-callback", { reason: "source" });

      return;
    }

    this.#finish(flight);
    this.#hooks.record("source-read-failed", {
      attempt: flight.attempt,
      reason: error.code,
    });
    this.#hooks.failed(flight.attempt, error);
    this.#settle(flight.group, {
      status: "failed",
      attempt: flight.attempt,
      error,
    });
    this.#startTrailing(flight.session);
  }

  #finish(flight: FeedFlight) {
    flight.finished = true;
    flight.release();

    if (this.#flight !== flight) {
      return;
    }

    this.#flight = null;
  }

  #settle(group: FeedWaiterGroup, result: FeedResult) {
    const waiters = [...group.waiters];

    group.waiters.clear();

    for (const waiter of waiters) {
      waiter.settle(result);
    }
  }

  // The session ended under the read: it is aborted, and everyone who waited for it or after it is told.
  #end(flight: FeedFlight) {
    if (flight.finished) {
      return;
    }

    flight.controller.abort();
    this.#finish(flight);
    this.#hooks.failed(
      flight.attempt,
      new BeaconError({
        code: "ABORTED",
        message: "The session ended during the check.",
      }),
    );
    this.#settle(flight.group, { status: "superseded" });

    if (this.#trailing === null) {
      return;
    }

    this.#settle(this.#trailing, { status: "superseded" });
    this.#trailing = null;
  }

  #leave(waiter: FeedWaiter) {
    const { group } = waiter;

    if (!group.waiters.delete(waiter)) {
      return;
    }

    waiter.settle({ status: "cancelled" });

    if (group.waiters.size > 0) {
      return;
    }

    const flight = this.#flight;

    if (flight === null || flight.group !== group) {
      return;
    }

    this.#abandon(flight);
  }

  // Nobody waits for the read anymore, so it is aborted and its answer will be ignored.
  #abandon(flight: FeedFlight) {
    flight.controller.abort();
    this.#finish(flight);
    this.#hooks.record("source-read-abandoned", { attempt: flight.attempt });
    this.#hooks.failed(
      flight.attempt,
      new BeaconError({
        code: "ABORTED",
        message: "Every caller stopped waiting for the check.",
      }),
    );
    this.#startTrailing(flight.session);
  }

  #startTrailing(session: Session) {
    const group = this.#trailing;

    if (group === null) {
      return;
    }

    this.#trailing = null;

    if (group.waiters.size === 0) {
      return;
    }

    if (!session.scope.isActive()) {
      this.#settle(group, { status: "superseded" });

      return;
    }

    this.#startFlight(session, group);
  }

  #armExpiry(session: Session, accepted: AcceptedFeed) {
    this.#cancelExpiry();

    this.#cancelExpiry = () => {};

    const { expiresAt, freshness } = accepted.evidence;

    if (expiresAt === null || freshness === "expired") {
      return;
    }

    const remaining = expiresAt - this.#clock.now();

    if (remaining <= 0) {
      this.#handleExpiry(session, accepted);

      return;
    }

    const cancel = this.#clock.setTimer(
      () => this.#handleExpiry(session, accepted),
      remaining,
    );

    const remove = session.scope.add(cancel);

    this.#cancelExpiry = () => {
      cancel();
      remove();
    };
  }

  #handleExpiry(session: Session, accepted: AcceptedFeed) {
    const { expiresAt } = accepted.evidence;

    if (this.#accepted !== accepted || expiresAt === null) {
      return;
    }

    // A host timer holds a bounded delay, so a long wait wakes early and is armed again.
    if (this.#clock.now() < expiresAt) {
      this.#armExpiry(session, accepted);

      return;
    }

    const evidence: Evidence = Object.freeze({
      ...accepted.evidence,
      freshness: "expired",
    });

    const expired: AcceptedFeed = Object.freeze({ ...accepted, evidence });

    this.#accepted = expired;
    this.#hooks.accepted(expired);
  }
}

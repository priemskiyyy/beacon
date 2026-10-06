import type { BeaconClock } from "src/types/BeaconClock";
import type { Evidence } from "src/types/Evidence";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { FeedHooks } from "src/types/internal/FeedHooks";
import type { ReadOptions } from "src/types/internal/ReadOptions";
import type { Session } from "src/types/internal/Session";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { SourceRead } from "src/types/SourceRead";
import { BeaconError } from "src/utils/BeaconError";
import { REVISION_MESSAGES } from "src/utils/constants/revisions";
import { boundTimers } from "src/utils/internal/clock/boundTimers";
import { createEvidence } from "src/utils/internal/feeds/createEvidence";
import { SharedRead } from "src/utils/internal/reads/SharedRead";
import { judgeRevision } from "src/utils/internal/revisions/judgeRevision";

type FeedRecordOptions = {
  source: ReleaseSource<unknown>;
  clock: BeaconClock;
  timeout: number;
  getScope: () => ReleaseScope;
  hooks: FeedHooks;
};

type Verdict = { accepted: AcceptedFeed; isRenewal: boolean };

/**
 * Owns one source: the document it accepted, the evidence behind it, and the
 * judgement of every answer against the decision already held. The read
 * itself is shared by everyone who asks.
 */
export class FeedRecord {
  #source: ReleaseSource<unknown>;
  #clock: BeaconClock;
  #timers: BeaconClock;
  #hooks: FeedHooks;
  #read: SharedRead<SourceRead<unknown>, Verdict>;
  #accepted: AcceptedFeed | null = null;
  #failure: BeaconError | null = null;
  #cancelExpiry = () => {};

  constructor({ source, clock, timeout, getScope, hooks }: FeedRecordOptions) {
    this.#source = source;
    this.#clock = clock;
    this.#timers = boundTimers(clock);
    this.#hooks = hooks;
    this.#read = new SharedRead<SourceRead<unknown>, Verdict>({
      clock,
      timeout,
      perform: ({ attempt, signal }) =>
        source.read({ scope: getScope(), signal, attempt, clock }),
      accept: (attempt, read) => this.#judge(attempt, read),
      hooks: {
        started: hooks.started,
        accepted: (attempt, verdict, session) =>
          this.#install(attempt, verdict, session),
        failed: (attempt, error) => this.#fail(attempt, error),
        record: hooks.record,
      },
      errors: {
        failed: {
          code: "SOURCE_FAILED",
          message:
            "A release source could not be read. The cause is on the read-failed event of beacon.diagnostics.events.",
        },
        invalid: {
          code: "INVALID_DOCUMENT",
          message: "A release source answered a document Beacon cannot accept.",
        },
        timeout: {
          code: "SOURCE_TIMEOUT",
          message: "A release source did not answer in time.",
        },
      },
    });
  }

  /** The document the source last answered, or `null` before any. */
  getAccepted = () => this.#accepted;

  /** The error of the last read that failed, until a read is accepted; `null` when the last one worked or none failed. A read nobody waited for is no failure of the source. */
  getFailure = () => this.#failure;

  /** Reads the source, or joins the read in flight; resolves when this caller's read settled, and never rejects. */
  read = (session: Session, options: ReadOptions) =>
    this.#read.read(session, options);

  /** Arms the expiry of a document held from an earlier session, or expires it if its time passed. */
  resume = (session: Session) => {
    const accepted = this.#accepted;

    if (accepted === null) {
      return;
    }

    this.#watch(session, accepted);
  };

  /** Forgets the document and its revision high-water mark, as another scope's evidence is never compared with this one's. */
  reset = () => {
    this.#cancelExpiry();

    this.#cancelExpiry = () => {};

    this.#accepted = null;
    this.#failure = null;
  };

  // Throws the error a rejected answer becomes; the held document is never touched here.
  #judge(attempt: number, read: SourceRead<unknown>): Verdict {
    const revision = read.revision ?? null;
    const expiresAt = read.expiresAt ?? null;
    const claim = { revision, digest: read.digest ?? null };

    // A source's own arithmetic can answer NaN, which no timer or comparison could ever expire.
    if (expiresAt !== null && !Number.isFinite(expiresAt)) {
      throw new BeaconError({
        code: "INVALID_DOCUMENT",
        message: "An expiry must be a finite epoch time in milliseconds.",
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
      expiresAt,
      issuer: read.issuer ?? null,
      revision,
    });

    // A renewal that proves nothing about its content does not make the decision forget the digest it was accepted with.
    const digest = verdict.status === "renewed" ? verdict.digest : claim.digest;

    return {
      accepted: Object.freeze({
        document: read.document,
        claim: Object.freeze({ revision, digest }),
        evidence,
        attempt,
      }),
      isRenewal: verdict.status === "renewed",
    };
  }

  #install(
    attempt: number,
    { accepted, isRenewal }: Verdict,
    session: Session,
  ) {
    const held = this.#armExpiry(
      session,
      accepted,
      accepted.evidence.receivedAt,
    );

    this.#accepted = held;
    this.#failure = null;
    this.#hooks.record(isRenewal ? "read-renewed" : "read-accepted", {
      attempt,
    });
    this.#hooks.accepted(held);
  }

  // A read that ended because nobody waited or the session ended says nothing about the source.
  #fail(attempt: number, error: BeaconError) {
    if (error.code !== "ABORTED") {
      this.#failure = error;
    }

    this.#hooks.failed(attempt, error);
  }

  // Waits for what remains of the document's time, and announces the document expired when that time has come or cannot be waited for.
  #watch(session: Session, accepted: AcceptedFeed) {
    const held = this.#armExpiry(session, accepted, this.#clock.now());

    if (held === accepted) {
      return;
    }

    this.#accepted = held;
    this.#hooks.accepted(held);
  }

  // Answers the document in force: expired when its time has come, or when the host's clock refuses the timer that would say so, since a document whose expiry nobody watches must not stay fresh. `now` is when the wait is measured from.
  #armExpiry(session: Session, accepted: AcceptedFeed, now: number) {
    this.#cancelExpiry();

    this.#cancelExpiry = () => {};

    const { expiresAt, freshness } = accepted.evidence;

    if (expiresAt === null || freshness === "expired") {
      return accepted;
    }

    const remaining = expiresAt - now;

    if (remaining <= 0) {
      return this.#expire(accepted);
    }

    try {
      // A host timer holds a bounded delay, so a long wait wakes early and waits again.
      const cancel = this.#timers.setTimer(
        () => this.#watch(session, accepted),
        remaining,
      );

      const remove = session.resources.add(cancel);

      this.#cancelExpiry = () => {
        cancel();
        remove();
      };
    } catch {
      return this.#expire(accepted);
    }

    return accepted;
  }

  #expire(accepted: AcceptedFeed): AcceptedFeed {
    const evidence: Evidence = Object.freeze({
      ...accepted.evidence,
      freshness: "expired",
    });

    return Object.freeze({ ...accepted, evidence });
  }
}

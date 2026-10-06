import type { BeaconClock } from "src/types/BeaconClock";
import type { Evidence } from "src/types/Evidence";
import type { AcceptedFeed } from "src/types/internal/AcceptedFeed";
import type { FeedHooks } from "src/types/internal/FeedHooks";
import type { Session } from "src/types/internal/Session";
import type { ReleaseScope } from "src/types/ReleaseScope";
import type { ReleaseSource } from "src/types/ReleaseSource";
import type { SourceRead } from "src/types/SourceRead";
import { BeaconError } from "src/utils/BeaconError";
import { REVISION_MESSAGES } from "src/utils/constants/revisions";
import { CANONICAL_DECIMAL_PATTERN } from "src/utils/constants/versions";
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

type ReadOptions = {
  mode: "join" | "after-current";
  signal: AbortSignal | undefined;
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
  #hooks: FeedHooks;
  #read: SharedRead<SourceRead<unknown>, Verdict>;
  #accepted: AcceptedFeed | null = null;
  #cancelExpiry = () => {};

  constructor({ source, clock, timeout, getScope, hooks }: FeedRecordOptions) {
    this.#source = source;
    this.#clock = clock;
    this.#hooks = hooks;
    this.#read = new SharedRead<SourceRead<unknown>, Verdict>({
      clock,
      timeout,
      perform: ({ attempt, signal }) =>
        source.read({ scope: getScope(), signal, attempt }),
      accept: (attempt, read) => this.#judge(attempt, read),
      hooks: {
        started: hooks.started,
        accepted: (attempt, verdict, session) =>
          this.#install(attempt, verdict, session),
        failed: hooks.failed,
        record: hooks.record,
      },
      errors: {
        failed: {
          code: "SOURCE_FAILED",
          message: "A release source could not be read.",
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

  /** Reads the source, or joins the read in flight; resolves when this caller's read settled, and never rejects. */
  read = (session: Session, options: ReadOptions) =>
    this.#read.read(session, options);

  /** Arms the expiry of a document held from an earlier session, or expires it if its time passed. */
  resume = (session: Session) => {
    const accepted = this.#accepted;

    if (accepted === null) {
      return;
    }

    this.#armExpiry(session, accepted);
  };

  /** Forgets the document and its revision high-water mark, as another scope's evidence is never compared with this one's. */
  reset = () => {
    this.#cancelExpiry();

    this.#cancelExpiry = () => {};

    this.#accepted = null;
  };

  // Throws the error a rejected answer becomes; the held document is never touched here.
  #judge(attempt: number, read: SourceRead<unknown>): Verdict {
    const revision = read.revision ?? null;
    const held = this.#accepted?.claim ?? null;
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

    const verdict = judgeRevision(held, claim);

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

    // A renewal that proves nothing about its content does not make the decision forget the digest it was accepted with.
    const digest =
      verdict.status === "renewed"
        ? (claim.digest ?? held?.digest ?? null)
        : claim.digest;

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
    this.#accepted = accepted;
    this.#armExpiry(session, accepted);
    this.#hooks.record(isRenewal ? "read-renewed" : "read-accepted", {
      attempt,
    });
    this.#hooks.accepted(accepted);
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

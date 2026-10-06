import type { WorkerReading } from "src/types/internal/WorkerReading";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { WorkerBody } from "src/types/WorkerBody";
import type { WorkerLike } from "src/types/WorkerLike";
import { UNKNOWN_WORKER_IDENTITY } from "src/utils/constants/identities";
import {
  FIRST_INSTALL,
  INSTALLING,
  NO_REGISTRATION,
} from "src/utils/constants/reasons";
import { getWorkerId } from "src/utils/getWorkerId";

const NOTHING_PREPARED: WorkerReading["prepared"] = { status: "none" };

// The core keeps a reference while the release is the same data, and an unknown identity is the same for every worker, so the instance is part of the release: another worker is another offer.
const createWorkerBody = (worker: WorkerLike): WorkerBody => {
  const id = getWorkerId(worker);

  return {
    release: {
      identity: UNKNOWN_WORKER_IDENTITY,
      metadata: { worker: { id } },
    },
    worker: { id },
  };
};

const createNoOffer = (
  detail: string | null,
): WorkerReading["observation"] => ({
  status: "none",
  reason: "no-decision",
  detail,
});

// An activation is observed when the worker the page was last known to run under has been replaced.
const readPrepared = (
  { active }: RegistrationLike,
  baseline: WorkerLike | null,
): WorkerReading["prepared"] => {
  if (baseline === null || active === null || active === baseline) {
    return NOTHING_PREPARED;
  }

  return { status: "ready", value: createWorkerBody(active) };
};

/**
 * What a registration says, as an observation and a prepared target. A
 * waiting worker is an update only when a worker was already active: the first
 * installation of a page is not one. Nothing is prepared until the baseline
 * worker, the first one seen active, has been replaced, since a skip-waiting
 * request alone proves no activation.
 */
export const readWorkers = (
  registration: RegistrationLike | undefined,
  baseline: WorkerLike | null,
): WorkerReading => {
  if (registration === undefined) {
    return {
      observation: createNoOffer(NO_REGISTRATION),
      prepared: NOTHING_PREPARED,
    };
  }

  const prepared = readPrepared(registration, baseline);
  const { waiting, active, installing } = registration;

  if (waiting !== null && active !== null) {
    return {
      observation: { status: "available", offer: createWorkerBody(waiting) },
      prepared,
    };
  }

  if (waiting !== null) {
    return { observation: createNoOffer(FIRST_INSTALL), prepared };
  }

  if (installing !== null) {
    return { observation: createNoOffer(INSTALLING), prepared };
  }

  return { observation: createNoOffer(null), prepared };
};

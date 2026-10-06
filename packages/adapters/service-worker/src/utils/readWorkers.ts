import type { WorkerReading } from "src/types/internal/WorkerReading";
import type { RegistrationLike } from "src/types/RegistrationLike";
import type { WorkerLike } from "src/types/WorkerLike";
import { UNKNOWN_WORKER_RELEASE } from "src/utils/constants/release";
import {
  FIRST_INSTALL,
  INSTALLING,
  NO_REGISTRATION,
} from "src/utils/constants/reasons";
import { getWorkerId } from "src/utils/getWorkerId";

const NOTHING: WorkerReading["prepared"] = { status: "none" };

const describe = (worker: WorkerLike) => ({
  release: UNKNOWN_WORKER_RELEASE,
  worker: { id: getWorkerId(worker) },
});

const none = (detail: string | null): WorkerReading["observation"] => ({
  status: "none",
  reason: "no-decision",
  detail,
});

// An activation is observed when the worker that was active when observation began has been replaced.
const readPrepared = (
  { active }: RegistrationLike,
  initialActive: WorkerLike | null,
): WorkerReading["prepared"] => {
  if (initialActive === null || active === null || active === initialActive) {
    return NOTHING;
  }

  return { status: "ready", value: describe(active) };
};

/**
 * What a registration says, as an observation and a prepared target. A
 * waiting worker is an update only when a worker was already active: the first
 * installation of a page is not one. Nothing is prepared until the worker that
 * was active when observation began has been replaced, since a skip-waiting
 * request alone proves no activation.
 */
export const readWorkers = (
  registration: RegistrationLike | undefined,
  initialActive: WorkerLike | null,
): WorkerReading => {
  if (registration === undefined) {
    return { observation: none(NO_REGISTRATION), prepared: NOTHING };
  }

  const prepared = readPrepared(registration, initialActive);
  const { waiting, active, installing } = registration;

  if (waiting !== null && active !== null) {
    return {
      observation: { status: "available", offer: describe(waiting) },
      prepared,
    };
  }

  if (waiting !== null) {
    return { observation: none(FIRST_INSTALL), prepared };
  }

  if (installing !== null) {
    return { observation: none(INSTALLING), prepared };
  }

  return { observation: none(null), prepared };
};

import type { RegistrationLike } from "src/types/RegistrationLike";
import type { WorkerLike } from "src/types/WorkerLike";

/**
 * Tells `onChange` whenever a worker of the registration changes state or a
 * new one starts installing, and answers how to stop. It listens to the
 * workers there are and to each one an update finds, and to nothing else.
 */
export const observeWorkers = (
  registration: RegistrationLike,
  onChange: () => void,
) => {
  const observed = new Set<WorkerLike>();

  const observe = (worker: WorkerLike | null) => {
    if (worker === null || observed.has(worker)) {
      return;
    }

    observed.add(worker);
    worker.addEventListener("statechange", onChange);
  };

  const handleUpdateFound = () => {
    observe(registration.installing);
    onChange();
  };

  observe(registration.installing);
  observe(registration.waiting);
  observe(registration.active);
  registration.addEventListener("updatefound", handleUpdateFound);

  return () => {
    registration.removeEventListener("updatefound", handleUpdateFound);

    for (const worker of observed) {
      worker.removeEventListener("statechange", onChange);
    }

    observed.clear();
  };
};

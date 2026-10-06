import type { WorkerLike } from "src/types/WorkerLike";

const ids = new WeakMap<WorkerLike, number>();

let count = 0;

/** A number that names one worker instance for as long as it lives, the same wherever it is read from. */
export const getWorkerId = (worker: WorkerLike) => {
  const known = ids.get(worker);

  if (known !== undefined) {
    return known;
  }

  count += 1;
  ids.set(worker, count);

  return count;
};

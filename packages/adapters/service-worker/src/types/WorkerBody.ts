import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * What an offer and a prepared target carry besides the release: the worker
 * they are about, by an id that names one observed worker instance. A script
 * URL is not an identity, since the bytes behind it can change, so the release
 * stays unknown until the application says otherwise.
 *
 * @example
 * ```ts
 * const body: WorkerBody = { release: UNKNOWN_WORKER_RELEASE, worker: { id: 1 } };
 * ```
 */
export type WorkerBody = RouteBody & { worker: { id: number } };

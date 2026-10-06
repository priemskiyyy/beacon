import type { RouteBody } from "@priemskiyyy/beacon";

/**
 * What an offer and a prepared target carry besides the release: the worker
 * they are about, by an id that names one observed worker instance. A script
 * URL is not an identity, since the bytes behind it can change, so the release
 * stays unknown until the application says otherwise. It holds the id as its
 * metadata, so another worker is another offer and a reference never follows a
 * replaced one.
 *
 * @example
 * ```ts
 * const body: WorkerBody = {
 *   release: {
 *     identity: { status: "unknown", reason: "worker-build-unknown" },
 *     metadata: { worker: { id: 1 } },
 *   },
 *   worker: { id: 1 },
 * };
 * ```
 */
export type WorkerBody = RouteBody & { worker: { id: number } };

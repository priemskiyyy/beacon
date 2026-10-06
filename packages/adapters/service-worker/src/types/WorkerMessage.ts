/**
 * The message a page posts to a worker. The worker decides what a `type`
 * means; Beacon only knows the one the application configured for skipping
 * the wait.
 *
 * @example
 * ```ts
 * const message: WorkerMessage = { type: "SKIP_WAITING" };
 * ```
 */
export type WorkerMessage = { type: string };

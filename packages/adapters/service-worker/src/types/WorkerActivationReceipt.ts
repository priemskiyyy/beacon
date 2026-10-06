/**
 * What an accepted activation proves: the worker was asked to skip waiting.
 * It says nothing about the worker having activated, which only a later state
 * change shows.
 *
 * @example
 * ```ts
 * const receipt: WorkerActivationReceipt = { kind: "activation-requested", worker: { id: 1 } };
 * ```
 */
export type WorkerActivationReceipt = {
  kind: "activation-requested";
  worker: { id: number };
};

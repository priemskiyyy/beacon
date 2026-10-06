import type { CheckReason } from "src/types/CheckReason";

/**
 * How to check. The default `join` shares a read that is already running.
 * `after-current` also asks for at most one trailing read after it, and never
 * restarts the current one. `signal` ends only this caller's wait: a read
 * others still wait for goes on.
 *
 * @example
 * ```ts
 * const controller = new AbortController();
 * const outcome = await beacon.check({ reason: "manual", signal: controller.signal });
 * ```
 */
export type CheckOptions = {
  reason?: CheckReason;
  mode?: "join" | "after-current";
  signal?: AbortSignal;
};

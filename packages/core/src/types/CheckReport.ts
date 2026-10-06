import type { CheckOutcome } from "src/types/CheckOutcome";

/**
 * The outcome of every route and of the support policy, apart, so a failing
 * policy never hides a successful route. There is no `allUpToDate` boolean:
 * read each route's observation. `support` is `null` without a policy.
 *
 * @example
 * ```ts
 * const report = await beacon.check({ reason: "startup" });
 *
 * if (report.support?.status === "failed") {
 *   console.warn("The support policy could not be read.");
 * }
 * ```
 */
export type CheckReport<TName extends string> = {
  routes: Record<TName, CheckOutcome>;
  support: CheckOutcome | null;
};

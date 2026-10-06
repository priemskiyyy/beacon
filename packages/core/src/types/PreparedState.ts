import type { Prepared } from "src/types/Prepared";
import type { Release } from "src/types/Release";

/**
 * Whether the provider reports something ready. It is kept apart from the
 * observation and from the progress of an operation, so a new download never
 * erases an older ready target, and `unknown` is what a provider that cannot
 * report across a restart starts with: never `none`.
 *
 * @example
 * ```ts
 * const { prepared } = beacon.route("ota").state.get();
 * ```
 */
export type PreparedState<
  TRoute extends string,
  TBody extends { release: Release<object | null> },
> =
  | { status: "not-applicable" }
  | { status: "unknown" }
  | { status: "none"; observedAt: number }
  | {
      status: "ready";
      value: Prepared<TRoute, TBody>;
      observedAt: number;
    };

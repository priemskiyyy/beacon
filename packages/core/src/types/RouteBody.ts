import type { Release } from "src/types/Release";

/**
 * What every offer and every prepared target carries besides its reference:
 * the release. A provider adds its own facts beside it, such as the flows a
 * store allows.
 *
 * @example
 * ```ts
 * type PlayOffer = RouteBody & { flows: Array<"flexible" | "immediate"> };
 * ```
 */
export type RouteBody = { release: Release<object | null> };

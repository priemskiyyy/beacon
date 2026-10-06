import type { Comparison } from "src/types/Comparison";

/** How two values of one total order compare. */
export type Ordering = Exclude<Comparison, "incomparable">;

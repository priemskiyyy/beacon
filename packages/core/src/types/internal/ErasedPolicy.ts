import type { SupportPolicy } from "src/types/SupportPolicy";

/** A support policy seen at its widest, as the runtime holds it. */
export type ErasedPolicy = SupportPolicy<unknown, unknown, string>;

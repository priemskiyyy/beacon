import type { ProviderResult } from "@priemskiyyy/beacon";

import type { PlayReceipt } from "src/types/PlayReceipt";

/** Why a flow may not start: a result that carries no receipt, since Play was not asked to start anything. */
export type Refusal = Extract<
  ProviderResult<PlayReceipt>,
  { status: "stale" | "unsupported" }
>;

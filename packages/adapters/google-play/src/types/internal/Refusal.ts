import type { ProviderResult } from "@priemskiyyy/beacon";

import type { PlayReceipt } from "src/types/PlayReceipt";

/** Why a flow did not start: a result that carries no receipt, since Play was asked to start nothing or declined to. */
export type Refusal = Exclude<
  ProviderResult<PlayReceipt>,
  { status: "accepted" }
>;

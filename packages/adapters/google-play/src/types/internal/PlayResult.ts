import type { ProviderResult } from "@priemskiyyy/beacon";

import type { PlayReceipt } from "src/types/PlayReceipt";

/** What a Play command answers: the receipt of its own kind, since annotating it keeps the receipt's `kind` a literal. */
export type PlayResult<TKind extends PlayReceipt["kind"]> = ProviderResult<
  Extract<PlayReceipt, { kind: TKind }>
>;

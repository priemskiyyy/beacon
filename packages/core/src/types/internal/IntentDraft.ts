import type { TransitionIntent } from "src/types/TransitionIntent";

/** An intent before the journal stamps it: the journal owns when it was created and when it expires. */
export type IntentDraft = Omit<TransitionIntent, "createdAt" | "expiresAt">;

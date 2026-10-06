import type { Refusal } from "src/types/internal/Refusal";
import type { PlayFlowResult } from "src/types/PlayFlowResult";

/** Why the consent step of a flow did not start it, as the result of the command that asked: `null` once the user agreed and Play took over. */
export const readFlow = (
  flow: PlayFlowResult,
  failure: string,
): Refusal | null => {
  if (flow === "cancelled") {
    return { status: "cancelled", stage: "consent" };
  }

  if (flow === "failed") {
    return {
      status: "failed",
      error: { code: "COMMAND_FAILED", message: failure },
    };
  }

  return null;
};

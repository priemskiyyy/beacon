import type { CheckState } from "src/types/CheckState";
import type { OperationState } from "src/types/OperationState";

/** No check has been attempted in this route yet. */
export const IDLE_CHECK: CheckState = Object.freeze({ state: "idle" });

/** No command is being carried out. */
export const IDLE_OPERATION: OperationState = Object.freeze({ state: "idle" });

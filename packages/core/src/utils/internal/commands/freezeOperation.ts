import type { OperationState } from "src/types/OperationState";

/** The operation of a route as it is published: a snapshot nobody can change, its operation id included. */
export const freezeOperation = (operation: OperationState): OperationState => {
  if (operation.state === "idle") {
    return operation;
  }

  return Object.freeze({
    ...operation,
    operation: Object.freeze({ ...operation.operation }),
  });
};

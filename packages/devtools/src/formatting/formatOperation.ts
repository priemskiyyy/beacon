import type { OperationState } from "@priemskiyyy/beacon";

import { boundText } from "src/utils/boundText";
import { assertUnreachable } from "src/utils/assertUnreachable";

/** The command a route is carrying out, or that it is idle. */
export const formatOperation = (operation: OperationState) => {
  if (operation.state === "idle") {
    return "idle";
  }

  if (operation.state === "running") {
    return `running ${boundText(operation.command)}`;
  }

  if (operation.state === "indeterminate") {
    return `indeterminate ${boundText(operation.command)}`;
  }

  return assertUnreachable(operation);
};

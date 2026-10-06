import { formatValueText } from "src/formatting/formatValueText";
import { inspectValue } from "src/utils/inspectValue";

/** The provider handle as a bounded copy with secret-named properties replaced, or that no session holds one. */
export const formatNative = (native: object | null) => {
  if (native === null) {
    return "[No open session holds a handle]";
  }

  return formatValueText(inspectValue(native));
};

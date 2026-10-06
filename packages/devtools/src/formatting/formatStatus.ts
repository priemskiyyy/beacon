import type { BeaconStatus } from "@priemskiyyy/beacon";

import { assertUnreachable } from "src/utils/assertUnreachable";

/** Where the session stands, with its number while it runs. */
export const formatStatus = (status: BeaconStatus) => {
  if (status.state === "running") {
    return `running, session ${status.session}`;
  }

  if (
    status.state === "idle" ||
    status.state === "stopped" ||
    status.state === "disposed"
  ) {
    return status.state;
  }

  return assertUnreachable(status);
};

import type { CommandOutcome, RouteHandle } from "@priemskiyyy/beacon";

import type { AppliedUpdate } from "src/types/AppliedUpdate";
import type { ExpoDownloadReceipt } from "src/types/ExpoDownloadReceipt";
import type { ExpoRoute } from "src/types/ExpoRoute";

type AcceptedDownload = Extract<
  CommandOutcome<ExpoDownloadReceipt>,
  { status: "accepted" }
>;

/** The reload of whatever is prepared now, read after any download, or no step at all when nothing is. */
export const reloadPrepared = async <TName extends string>(
  route: RouteHandle<TName, ExpoRoute>,
  download: AcceptedDownload | null,
): Promise<AppliedUpdate> => {
  const { prepared } = route.state.get();

  if (prepared.status !== "ready") {
    return { step: "none" };
  }

  const outcome = await route.reload({ prepared: prepared.value.ref });

  return { step: "reload", outcome, download };
};

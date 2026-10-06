import type { DriverSession } from "src/types/DriverSession";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { RouteBody } from "src/types/RouteBody";
import type { BeaconError } from "src/utils/BeaconError";
import type { SharedRead } from "src/utils/internal/reads/SharedRead";

/** One provider driver route: the shared check and the session that answers it while a session is open. */
export type DriverEntry = {
  read: SharedRead<ObservationDraft<RouteBody>, ObservationDraft<RouteBody>>;
  session: DriverSession<object, RouteBody> | null;
  /** Why the provider did not open in this session, for the check that finds it closed; `null` while it is open or was not asked to open. */
  notOpen: BeaconError | null;
};

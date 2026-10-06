import type { DriverSession } from "src/types/DriverSession";
import type { ObservationDraft } from "src/types/ObservationDraft";
import type { RouteBody } from "src/types/RouteBody";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { SharedRead } from "src/utils/internal/reads/SharedRead";

/** One provider driver route: the shared check and the session that answers it while a session is open. */
export type DriverEntry = {
  route: RouteEntry;
  read: SharedRead<ObservationDraft<RouteBody>, ObservationDraft<RouteBody>>;
  session: DriverSession<object, RouteBody> | null;
};

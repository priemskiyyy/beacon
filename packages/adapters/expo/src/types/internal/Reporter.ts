import type { DriverEmitter } from "@priemskiyyy/beacon";

import type { ExpoBody } from "src/types/ExpoBody";

/** How a command tells its route what it prepared, for as long as the session that owns the route lives. */
export type Reporter = DriverEmitter<ExpoBody, ExpoBody>;

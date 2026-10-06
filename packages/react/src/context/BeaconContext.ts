import { createContext } from "react";

import type { ReactBeacon } from "src/types/ReactBeacon";

export const BeaconContext = createContext<ReactBeacon | undefined>(undefined);

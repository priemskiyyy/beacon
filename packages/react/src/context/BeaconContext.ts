import { createContext } from "react";

import type { RegisteredBeacon } from "src/types/Register";

export const BeaconContext = createContext<RegisteredBeacon | undefined>(
  undefined,
);

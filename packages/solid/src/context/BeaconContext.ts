import { createContext } from "solid-js";
import type { Accessor } from "solid-js";

import type { RegisteredBeacon } from "src/types/Register";

export const BeaconContext = createContext<Accessor<RegisteredBeacon>>();

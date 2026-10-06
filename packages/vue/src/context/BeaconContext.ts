import type { ComputedRef, InjectionKey } from "vue";

import type { RegisteredBeacon } from "src/types/Register";

export const BEACON_CONTEXT: InjectionKey<ComputedRef<RegisteredBeacon>> =
  Symbol("beacon");

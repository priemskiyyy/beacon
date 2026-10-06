import type { DriverEmitter } from "@priemskiyyy/beacon/adapter";

import type { ExpoBody } from "src/types/ExpoBody";
import type { ExpoNative } from "src/types/ExpoNative";

/** How a command tells its route what it prepared: the emitter of the session that owns the handle it runs on, and none once that session ended. */
export const emitters = new WeakMap<
  ExpoNative,
  DriverEmitter<ExpoBody, ExpoBody>
>();

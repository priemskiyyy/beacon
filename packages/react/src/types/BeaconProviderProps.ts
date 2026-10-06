import type { PropsWithChildren } from "react";

import type { RegisteredBeacon } from "src/types/Register";

/**
 * The Beacon to publish, and whether the provider holds the observation
 * session while it is mounted, `true` by default. `start: false` leaves the
 * session to the application.
 *
 * @example
 * ```tsx
 * const props: BeaconProviderProps = { beacon, start: false };
 * ```
 */
export type BeaconProviderProps = PropsWithChildren<{
  beacon: RegisteredBeacon;
  start?: boolean;
}>;

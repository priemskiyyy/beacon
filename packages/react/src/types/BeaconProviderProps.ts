import type { PropsWithChildren } from "react";

import type { RegisteredBeacon } from "src/types/Register";

/**
 * The Beacon to publish, and whether the provider holds the observation
 * session while it is mounted, `false` by default.
 *
 * @example
 * ```tsx
 * const props: BeaconProviderProps = { beacon, start: true };
 * ```
 */
export type BeaconProviderProps = PropsWithChildren<{
  beacon: RegisteredBeacon;
  start?: boolean;
}>;

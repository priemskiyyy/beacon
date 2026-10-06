import type { PropsWithChildren } from "react";

import type { ReactBeacon } from "src/types/ReactBeacon";

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
  beacon: ReactBeacon;
  start?: boolean;
}>;

import type { ParentProps } from "solid-js";

import type { RegisteredBeacon } from "src/types/Register";

/**
 * The Beacon to publish, and whether the provider holds the observation
 * session while it is mounted, `false` by default. A provider follows both.
 *
 * @example
 * ```tsx
 * const props: BeaconProviderProps = { beacon, start: true };
 * ```
 */
export type BeaconProviderProps = ParentProps<{
  beacon: RegisteredBeacon;
  start?: boolean;
}>;

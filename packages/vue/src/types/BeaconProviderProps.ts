import type { RegisteredBeacon } from "src/types/Register";

/**
 * The Beacon to publish, and whether the provider holds the observation
 * session while it is mounted, `false` by default.
 *
 * @example
 * ```ts
 * const props: BeaconProviderProps = { beacon, start: true };
 * ```
 */
export type BeaconProviderProps = {
  beacon: RegisteredBeacon;
  start?: boolean;
};

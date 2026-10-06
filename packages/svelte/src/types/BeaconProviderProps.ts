import type { Snippet } from "svelte";
import type { RegisteredBeacon } from "./Register.js";

/**
 * The props of `BeaconProvider`: the Beacon to publish, whether the provider
 * holds the observation session while it is mounted (`false` by default), and
 * the content that reads it.
 *
 * @example
 * ```ts
 * const props: BeaconProviderProps = { beacon, start: true };
 * ```
 */
export type BeaconProviderProps = {
  beacon: RegisteredBeacon;
  start?: boolean | undefined;
  children?: Snippet | undefined;
};

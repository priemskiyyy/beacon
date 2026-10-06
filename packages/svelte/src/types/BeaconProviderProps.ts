import type { Snippet } from "svelte";
import type { RegisteredBeacon } from "./Register.js";

/**
 * The props of `BeaconProvider`: the Beacon to publish, whether the provider
 * holds the observation session while it is mounted (`true` by default; `false`
 * leaves the session to the application), and the content that reads it.
 *
 * @example
 * ```ts
 * const props: BeaconProviderProps = { beacon, start: false };
 * ```
 */
export type BeaconProviderProps = {
  beacon: RegisteredBeacon;
  start?: boolean | undefined;
  children?: Snippet | undefined;
};

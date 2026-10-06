import type { BeaconProviderProps } from "../types/BeaconProviderProps.js";
/**
 * Publishes one Beacon to the components below. With `start`, it holds
 * the observation session while mounted and ends only that session on unmount; it
 * never disposes the Beacon, and it checks nothing. A server render starts nothing.
 * @example `<BeaconProvider {beacon} start><Application /></BeaconProvider>`
 */
declare const BeaconProvider: import("svelte").Component<BeaconProviderProps, {}, "">;
type BeaconProvider = ReturnType<typeof BeaconProvider>;
export default BeaconProvider;

import type { BeaconDevtoolsOptions } from "src/types/BeaconDevtoolsOptions";

/**
 * Props of the React wrapper: the inspector's options without `beacon`, which
 * the wrapper reads from the nearest `BeaconProvider`.
 *
 * @example
 * ```ts
 * const props: BeaconDevtoolsProps = { initialIsOpen: true, maxEvents: 500 };
 * ```
 */
export type BeaconDevtoolsProps = Omit<BeaconDevtoolsOptions, "beacon">;

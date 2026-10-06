import type { BeaconError } from "src/utils/BeaconError";

/** A selection or an evaluation that failed after its read was accepted, and the attempt it belongs to. */
export type CheckFailure = { attempt: number; error: BeaconError };

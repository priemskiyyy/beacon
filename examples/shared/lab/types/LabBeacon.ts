import type { createLabBeacon } from "example-shared/lab/utils/createLabBeacon";

/** The Beacon of one lab document, with the type of every route it holds. */
export type LabBeacon = ReturnType<typeof createLabBeacon>;

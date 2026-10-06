import type { CommandMap } from "src/types/CommandMap";
import type { ReleaseDriver } from "src/types/ReleaseDriver";
import type { RouteBody } from "src/types/RouteBody";

/** A provider driver seen at its widest, as the runtime holds it. */
export type ErasedDriver = ReleaseDriver<
  unknown,
  RouteBody,
  RouteBody,
  CommandMap<unknown, RouteBody, RouteBody>
>;

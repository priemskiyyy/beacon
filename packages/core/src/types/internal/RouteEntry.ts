import type { CommandMap } from "src/types/CommandMap";
import type { RouteRuntime } from "src/types/internal/RouteRuntime";
import type { RouteBody } from "src/types/RouteBody";
import type { RunningSubject } from "src/types/RunningSubject";
import type { RouteRecord } from "src/utils/internal/routes/RouteRecord";

/** One configured route: its name, the running subject it replaces, the commands of its mechanism or driver, its published state, and how it opens and is checked. */
export type RouteEntry = {
  name: string;
  /** The running subject a command of this route replaces: its own for a feed route, the provider's for a driver route. */
  subject: RunningSubject;
  commands: CommandMap<object, RouteBody, RouteBody>;
  record: RouteRecord;
  runtime: RouteRuntime;
};

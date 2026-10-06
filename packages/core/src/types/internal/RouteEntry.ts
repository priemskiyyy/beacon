import type { RouteRuntime } from "src/types/internal/RouteRuntime";
import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteRecord } from "src/utils/internal/routes/RouteRecord";

/** One configured route: its name, its definition as the application wrote it, its published state, and how it opens and is checked. */
export type RouteEntry = {
  name: string;
  definition: RouteDefinition;
  record: RouteRecord;
  runtime: RouteRuntime;
};

import type { RouteDefinition } from "src/types/RouteDefinition";
import type { RouteRecord } from "src/utils/internal/routes/RouteRecord";

/** One configured route: its name, its definition as the application wrote it, and its published state. */
export type RouteEntry = {
  name: string;
  definition: RouteDefinition;
  record: RouteRecord;
};

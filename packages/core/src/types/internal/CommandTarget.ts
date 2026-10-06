import type { ErasedCommand } from "src/types/internal/ErasedCommand";
import type { RouteEntry } from "src/types/internal/RouteEntry";

/** One command of one route: where it runs, what it is called and what it declared. */
export type CommandTarget = {
  entry: RouteEntry;
  name: string;
  command: ErasedCommand;
};

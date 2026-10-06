import type { CommandParameters } from "src/types/CommandParameters";
import type { CommandResult } from "src/types/internal/CommandResult";
import type { Lease } from "src/types/internal/Lease";
import type { RouteEntry } from "src/types/internal/RouteEntry";

/**
 * One command holding its route: what it was called with, so an identical
 * call can join it, the reservations it holds, and whether it is still
 * running or was left unresolved because its outcome was never confirmed.
 */
export type CommandOperation = {
  id: number;
  entry: RouteEntry;
  command: string;
  reference: object | null;
  parameters: CommandParameters;
  disruptive: boolean;
  replacesRealm: boolean;
  phase: "running" | "unresolved";
  lease: Lease | null;
  outcome: Promise<CommandResult>;
};

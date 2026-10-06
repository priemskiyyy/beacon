import type { CommandParameters } from "src/types/CommandParameters";
import type { CommandResult } from "src/types/internal/CommandResult";
import type { Lease } from "src/types/internal/Lease";
import type { RouteEntry } from "src/types/internal/RouteEntry";
import type { Session } from "src/types/internal/Session";

/**
 * One command holding its route: what it was called with, so an identical
 * call can join it, the reservations it holds, and how far it got.
 */
export type CommandOperation = {
  id: number;
  /** The session the call was made in, whose running facts the command is judged against. */
  session: Session;
  entry: RouteEntry;
  command: string;
  reference: object | null;
  parameters: CommandParameters;
  disruptive: boolean;
  replacesRealm: boolean;
  /** `running` until the provider is asked, `dispatched` while it answers, `unresolved` when its outcome was never confirmed. */
  phase: "running" | "dispatched" | "unresolved";
  lease: Lease | null;
  outcome: Promise<CommandResult>;
};

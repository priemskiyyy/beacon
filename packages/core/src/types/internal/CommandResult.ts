import type { CommandOutcome } from "src/types/CommandOutcome";

/** A command's outcome with its receipt erased, as the runtime holds it. */
export type CommandResult = CommandOutcome<{ kind: string }>;

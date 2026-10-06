import type { CommandArguments } from "src/types/CommandArguments";
import type { CommandOutcome } from "src/types/CommandOutcome";
import type { ParametersOf } from "src/types/internal/ParametersOf";
import type { ReceiptOf } from "src/types/internal/ReceiptOf";
import type { RequirementOf } from "src/types/internal/RequirementOf";

/**
 * The methods a route gets from its commands, with input and receipt types
 * derived from the command declarations, so no second map of them exists.
 *
 * @example
 * ```ts
 * type WebCommands = CommandFacade<"web", typeof mechanism.commands>;
 * ```
 */
export type CommandFacade<TRoute extends string, TCommands> = {
  [TName in keyof TCommands]: (
    ...args: CommandArguments<
      TRoute,
      RequirementOf<TCommands[TName]>,
      ParametersOf<TCommands[TName]>
    >
  ) => Promise<CommandOutcome<ReceiptOf<TCommands[TName]>>>;
};

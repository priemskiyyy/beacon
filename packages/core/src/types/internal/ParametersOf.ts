import type { CommandParameters } from "src/types/CommandParameters";

/** The parameters a command's `run` reads, or none when it takes only its references. */
export type ParametersOf<TCommand> = TCommand extends {
  run(context: infer TContext): Promise<unknown>;
}
  ? TContext extends { parameters: infer TParameters extends CommandParameters }
    ? object extends TParameters
      ? Record<never, never>
      : TParameters
    : Record<never, never>
  : never;

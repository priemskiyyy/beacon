/** The parameters a command's `run` reads, or none when it takes only its references. */
export type ParametersOf<TCommand> = TCommand extends {
  run(context: infer TContext): Promise<unknown>;
}
  ? TContext extends { parameters: infer TParameters extends object }
    ? object extends TParameters
      ? Record<never, never>
      : TParameters
    : Record<never, never>
  : never;

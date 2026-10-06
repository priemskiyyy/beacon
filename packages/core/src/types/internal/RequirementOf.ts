/** The reference a command declares, read from its `reference` literal. */
export type RequirementOf<TCommand> = TCommand extends {
  reference: infer TRequirement;
}
  ? TRequirement
  : never;

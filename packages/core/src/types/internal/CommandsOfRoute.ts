/** The commands a route carries, from its mechanism or its driver. */
export type CommandsOfRoute<TDefinition> = TDefinition extends {
  kind: "feed";
  mechanism: { commands: infer TCommands };
}
  ? TCommands
  : TDefinition extends {
        kind: "driver";
        driver: { commands: infer TCommands };
      }
    ? TCommands
    : never;

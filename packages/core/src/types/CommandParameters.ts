/**
 * What a command may take besides its references. `offer`, `prepared` and
 * `signal` are Beacon's own keys, so a command cannot declare a parameter of
 * that name.
 *
 * @example
 * ```ts
 * type FlowParameters = { flow: "flexible" | "immediate" };
 * ```
 */
export type CommandParameters = object & {
  offer?: never;
  prepared?: never;
  signal?: never;
};

import type { CommandDescriptor } from "src/types/CommandDescriptor";
import type { CommandParameters } from "src/types/CommandParameters";
import type { RouteBody } from "src/types/RouteBody";

/** A command seen at its widest, as the runtime holds it. */
export type ErasedCommand = CommandDescriptor<
  object,
  RouteBody,
  RouteBody,
  CommandParameters,
  { kind: string }
>;

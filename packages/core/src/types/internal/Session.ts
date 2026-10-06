import type { ResourceScope } from "src/utils/internal/runtime/ResourceScope";

/** One start-to-stop observation session: its number, and the scope every resource and callback of it belongs to. */
export type Session = {
  id: number;
  scope: ResourceScope;
};

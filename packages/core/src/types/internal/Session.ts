import type { ResourceScope } from "src/utils/internal/runtime/ResourceScope";

/** One start-to-stop observation session: its number, and the resources every callback of it owns, released when it ends. */
export type Session = {
  id: number;
  resources: ResourceScope;
};

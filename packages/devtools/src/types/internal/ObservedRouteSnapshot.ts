import type { ObservedRoute } from "src/types/internal/ObservedRoute";

export type ObservedRouteSnapshot = ReturnType<ObservedRoute["state"]["get"]>;

import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardManifest } from "src/types/StandardManifest";
import { invalidManifest } from "src/utils/invalidManifest";
import { mapDecisions } from "src/utils/mapDecisions";
import { readDecision } from "src/utils/readDecision";
import { readField } from "src/utils/readField";
import { readRecord } from "src/utils/readRecord";

/** The decision of every declared route. A route the manifest lacks is a refusal, never a decision to offer nothing. */
export const readRoutes = <TDeclarations extends RouteDeclarations>(
  record: JsonRecord,
  declarations: TDeclarations,
): StandardManifest<TDeclarations>["routes"] => {
  const decisions = readRecord(readField(record, "routes"), "routes");

  return mapDecisions(declarations, (name, declaration) => {
    const decision = readField(decisions, name);

    if (decision === undefined) {
      throw invalidManifest(`routes.${name} is missing.`);
    }

    return readDecision(decision, `routes.${name}`, declaration);
  });
};

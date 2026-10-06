import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardSupport } from "src/types/StandardSupport";
import { SUBJECTS } from "src/utils/constants/subjects";
import { invalidManifest } from "src/utils/invalidManifest";
import { isRouteName } from "src/utils/isRouteName";
import { readField } from "src/utils/readField";
import { readList } from "src/utils/readList";
import { readRecord } from "src/utils/readRecord";
import { readText } from "src/utils/readText";

/** The support facts of a manifest, or `null` when it has none; the remediation route has to be one the application declared. */
export const readSupport = <TDeclarations extends RouteDeclarations>(
  record: JsonRecord,
  declarations: TDeclarations,
): StandardSupport<keyof TDeclarations & string> | null => {
  const value = readField(record, "support");

  if (value === undefined) {
    return null;
  }

  const support = readRecord(value, "support");

  const subject = SUBJECTS.get(
    readText(readField(support, "subject"), "support.subject"),
  );

  const remediationRoute = readText(
    readField(support, "remediationRoute"),
    "support.remediationRoute",
  );

  if (subject === undefined) {
    throw invalidManifest("support.subject must be a running subject.");
  }

  if (!isRouteName(declarations, remediationRoute)) {
    throw invalidManifest("support.remediationRoute must be a declared route.");
  }

  return {
    revision: readText(readField(support, "revision"), "support.revision"),
    subject,
    deniedReleaseIds: readList(
      readField(support, "deniedReleaseIds"),
      "support.deniedReleaseIds",
      readText,
    ),
    reasonCode: readText(
      readField(support, "reasonCode"),
      "support.reasonCode",
    ),
    remediationRoute,
  };
};

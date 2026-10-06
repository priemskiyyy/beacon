import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { StandardSupport } from "src/types/StandardSupport";
import { SUBJECTS } from "src/utils/constants/subjects";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readList } from "src/utils/readList";
import { readRecord } from "src/utils/readRecord";
import { readText } from "src/utils/readText";

/** The support facts of a manifest, or `null` when it has none; the remediation route has to be one the application declared. */
export const readSupport = <TRoute extends string>(
  record: JsonRecord,
  routeNames: TRoute[],
): StandardSupport<TRoute> | null => {
  const value = readField(record, "support");

  if (value === undefined) {
    return null;
  }

  const support = readRecord(value, "support");
  const subject = readText(readField(support, "subject"), "support.subject");

  const remediation = readText(
    readField(support, "remediationRoute"),
    "support.remediationRoute",
  );

  const route = routeNames.find((name) => name === remediation);
  const known = SUBJECTS.get(subject);

  if (known === undefined) {
    throw invalidManifest("support.subject must be a running subject.");
  }

  if (route === undefined) {
    throw invalidManifest("support.remediationRoute must be a declared route.");
  }

  return {
    revision: readText(readField(support, "revision"), "support.revision"),
    subject: known,
    deniedReleaseIds: readList(
      readField(support, "deniedReleaseIds"),
      "support.deniedReleaseIds",
      readText,
    ),
    reasonCode: readText(
      readField(support, "reasonCode"),
      "support.reasonCode",
    ),
    remediationRoute: route,
  };
};

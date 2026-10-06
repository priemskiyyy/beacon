import type { ParseStandardManifestOptions } from "src/types/ParseStandardManifestOptions";
import type { RouteDeclarations } from "src/types/RouteDeclarations";
import type { StandardRead } from "src/types/StandardRead";
import { DEFAULT_LIMITS, SCHEMA_VERSION } from "src/utils/constants/limits";
import { fingerprint } from "src/utils/fingerprint";
import { invalidManifest } from "src/utils/invalidManifest";
import { listRouteNames } from "src/utils/listRouteNames";
import { measureBytes } from "src/utils/measureBytes";
import { readField } from "src/utils/readField";
import { readRecord } from "src/utils/readRecord";
import { readRevision } from "src/utils/readRevision";
import { readRoutes } from "src/utils/readRoutes";
import { readScope } from "src/utils/readScope";
import { readSupport } from "src/utils/readSupport";
import { readValidity } from "src/utils/readValidity";

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    throw invalidManifest("The manifest is not JSON.");
  }
};

/**
 * Reads the text of a standard manifest, or throws a `BeaconError` with
 * `INVALID_DOCUMENT` that names the first rule it breaks. The whole document
 * is accepted or none of it: a manifest that is too large, of an unknown
 * schema version, for another scope, without a declared route, with a
 * decision that contradicts its route, or with times that do not hold is never
 * partly read. The text is decoded as JSON, so a repeated key keeps its last
 * value, and a field the schema does not name is ignored and never reaches the
 * document.
 *
 * @example
 * ```ts
 * const { document, revision, digest, expiresAt } = parseStandardManifest({
 *   text: await response.text(),
 *   scope,
 *   routes: { web: { kind: "target" } },
 *   now: Date.now(),
 * });
 * ```
 */
export const parseStandardManifest = <TDeclarations extends RouteDeclarations>({
  text,
  scope,
  routes,
  now,
  limits,
}: ParseStandardManifestOptions<TDeclarations>): StandardRead<TDeclarations> => {
  const bounds = { ...DEFAULT_LIMITS, ...limits };

  // A text of more characters than the limit has more bytes, so it is not measured.
  if (text.length > bounds.bytes || measureBytes(text) > bounds.bytes) {
    throw invalidManifest(`The manifest is larger than ${bounds.bytes} bytes.`);
  }

  const record = readRecord(parseJson(text), "The manifest");

  if (readField(record, "schemaVersion") !== SCHEMA_VERSION) {
    throw invalidManifest(
      `The manifest schema version must be ${SCHEMA_VERSION}.`,
    );
  }

  readScope(record, scope);

  const revision = readRevision(
    readField(record, "decisionRevision"),
    "decisionRevision",
  );

  const expiresAt = readValidity({ record, now, limits: bounds });

  const decisions = readRoutes(record, routes);

  const document = {
    routes: decisions,
    support: readSupport(record, listRouteNames(routes)),
  };

  return {
    document,
    revision,
    // The support facts carry a revision of their own, so a policy update under the same decision is a renewal, not a conflict.
    digest: fingerprint(JSON.stringify(decisions)),
    expiresAt,
  };
};

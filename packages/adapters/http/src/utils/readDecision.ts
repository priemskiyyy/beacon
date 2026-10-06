import type { NoneDecision } from "@priemskiyyy/beacon";

import type { FieldReader } from "src/types/internal/FieldReader";
import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { RouteDeclaration } from "src/types/RouteDeclaration";
import type { StandardDecision } from "src/types/StandardDecision";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readOrder } from "src/utils/readOrder";
import { readRecord } from "src/utils/readRecord";
import { readRelease } from "src/utils/readRelease";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

const readNone: FieldReader<NoneDecision> = (record, field) => ({
  kind: "none",
  reason: readText(readField(record, "reason"), `${field}.reason`),
});

const readReleaseRecord = (record: JsonRecord, field: string) =>
  readRecord(readField(record, "release"), `${field}.release`);

const contradicts = (field: string, expected: RouteDeclaration["kind"]) =>
  invalidManifest(
    `${field}.kind contradicts the route, which declares ${expected}.`,
  );

/** The decision a route holds, of the one kind its declaration allows; a decision of another kind is refused. */
export const readDecision = (
  value: unknown,
  field: string,
  declaration: RouteDeclaration,
): StandardDecision<RouteDeclaration> =>
  readVariant<StandardDecision<RouteDeclaration>>({
    value,
    field,
    tag: "kind",
    readers: {
      none: readNone,
      target: (record, path) => {
        if (declaration.kind !== "target") {
          throw contradicts(path, declaration.kind);
        }

        const release = readReleaseRecord(record, path);

        return {
          kind: "target",
          release: readRelease(release, `${path}.release`),
        };
      },
      candidate: (record, path) => {
        if (declaration.kind !== "candidate") {
          throw contradicts(path, declaration.kind);
        }

        const release = readReleaseRecord(record, path);

        return {
          kind: "candidate",
          release: {
            ...readRelease(release, `${path}.release`),
            order: readOrder(
              declaration.order,
              readField(release, "order"),
              `${path}.release.order`,
            ),
          },
        };
      },
    },
  });

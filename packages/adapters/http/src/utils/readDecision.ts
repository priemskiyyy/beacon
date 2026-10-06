import type { NoneDecision } from "@priemskiyyy/beacon";

import type { FieldReader } from "src/types/internal/FieldReader";
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

const contradicts = (field: string, expected: RouteDeclaration["kind"]) =>
  invalidManifest(
    `${field}.kind contradicts the route, which declares ${expected}.`,
  );

// The overload promises each declaration the decisions it allows; the readers keep that promise by refusing any other kind.
export function readDecision<TDeclaration extends RouteDeclaration>(
  value: unknown,
  field: string,
  declaration: TDeclaration,
): StandardDecision<TDeclaration>;

export function readDecision(
  value: unknown,
  field: string,
  declaration: RouteDeclaration,
): StandardDecision<RouteDeclaration> {
  return readVariant<StandardDecision<RouteDeclaration>>({
    value,
    field,
    tag: "kind",
    readers: {
      none: readNone,
      target: (record, path) => {
        if (declaration.kind !== "target") {
          throw contradicts(path, declaration.kind);
        }

        const release = readRecord(
          readField(record, "release"),
          `${path}.release`,
        );

        return {
          kind: "target",
          release: readRelease(release, `${path}.release`),
        };
      },
      candidate: (record, path) => {
        if (declaration.kind !== "candidate") {
          throw contradicts(path, declaration.kind);
        }

        const release = readRecord(
          readField(record, "release"),
          `${path}.release`,
        );

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
}

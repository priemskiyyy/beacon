import type { NoneDecision } from "@priemskiyyy/beacon";

import type { VariantReader } from "src/types/internal/VariantReader";
import type { JsonRecord } from "src/types/internal/JsonRecord";
import type { OrderKind } from "src/types/OrderKind";
import type { OrderValues } from "src/types/OrderValues";
import type { RouteDeclaration } from "src/types/RouteDeclaration";
import type { StandardDecision } from "src/types/StandardDecision";
import { invalidManifest } from "src/utils/invalidManifest";
import { readField } from "src/utils/readField";
import { readRecord } from "src/utils/readRecord";
import { readRelease } from "src/utils/readRelease";
import { readText } from "src/utils/readText";
import { readVariant } from "src/utils/readVariant";

// A safe, non-negative integer, which no number size rounds.
const readInteger = (value: unknown, field: string): number => {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw invalidManifest(`${field} must be a safe non-negative integer.`);
  }

  return value;
};

// One reader for each kind of order, so a route reads the order its version strategy takes.
const ORDERS: {
  [TKind in OrderKind]: (value: unknown, field: string) => OrderValues[TKind];
} = {
  text: readText,
  integer: readInteger,
};

const readNone: VariantReader<NoneDecision> = (record, field) => ({
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
            order: ORDERS[declaration.order](
              readField(release, "order"),
              `${path}.release.order`,
            ),
          },
        };
      },
    },
  });

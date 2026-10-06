import { MAXIMUM_LIST_LENGTH } from "src/utils/constants/limits";
import { invalidManifest } from "src/utils/invalidManifest";

/** A bounded list whose items all read, or a refusal naming the field. */
export const readList = <TItem>(
  value: unknown,
  field: string,
  read: (item: unknown, field: string) => TItem,
): TItem[] => {
  if (!Array.isArray(value)) {
    throw invalidManifest(`${field} must be a list.`);
  }

  if (value.length > MAXIMUM_LIST_LENGTH) {
    throw invalidManifest(
      `${field} must have at most ${MAXIMUM_LIST_LENGTH} items.`,
    );
  }

  return value.map((item, index) => read(item, `${field}[${index}]`));
};

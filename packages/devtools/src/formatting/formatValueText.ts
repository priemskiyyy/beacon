import { boundText } from "src/utils/boundText";
import { BLOCK_TEXT } from "src/utils/constants/redaction";

/** Indented JSON of an already inspected value, cut off after 12k characters. */
export const formatValueText = (value: unknown) =>
  boundText(JSON.stringify(value, null, 2) ?? "undefined", BLOCK_TEXT);

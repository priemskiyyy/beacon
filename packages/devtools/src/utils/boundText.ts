import { FIELD_TEXT, TRUNCATED } from "src/utils/constants/redaction";

/** Cuts a text to a limit and says so, so a hostile or runaway string never fills the panel. */
export const boundText = (text: string, limit = FIELD_TEXT) => {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}… ${TRUNCATED}`;
};

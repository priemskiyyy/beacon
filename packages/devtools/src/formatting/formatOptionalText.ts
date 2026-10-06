import { boundText } from "src/utils/boundText";

/** A text a fact may lack, bounded, or `none`. */
export const formatOptionalText = (text: string | null | undefined) => {
  if (text === null || text === undefined) {
    return "none";
  }

  return boundText(text);
};

import { NOT_INJECTED_TEXTS } from "src/utils/constants/sentinels";

/**
 * What a bundler put in the code as text with no space around it, or `null`
 * when it put nothing: a define that was never set compiles to `undefined`
 * (Vite 8 writes `void 0`), an empty one to an empty string, and one written
 * into a string to the text `undefined`. The journal compares identities
 * exactly, so none of these may become a build.
 */
export const readBuildText = (value: string | null | undefined) => {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text === "" || NOT_INJECTED_TEXTS.has(text)) {
    return null;
  }

  return text;
};

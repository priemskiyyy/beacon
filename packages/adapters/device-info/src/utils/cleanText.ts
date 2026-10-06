/**
 * What an SDK gave as text with no space around it, or `null` when it gave
 * nothing, only spaces, or no text at all. The journal compares identities
 * exactly, so a space after a build number is a build that never matches
 * itself.
 */
export const cleanText = (value: string | null | undefined) => {
  // A provider SDK is a trust boundary: its types promise text, and a native module can still answer otherwise.
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  if (text === "") {
    return null;
  }

  return text;
};

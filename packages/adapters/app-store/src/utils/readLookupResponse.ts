import type { AppStoreLookupEntry } from "src/types/AppStoreLookupEntry";
import type { AppStoreLookupResponse } from "src/types/AppStoreLookupResponse";
import { invalidLookup } from "src/utils/invalidLookup";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Only the four fields the source reads are kept; the lookup has some forty more.
const readEntry = (value: unknown): AppStoreLookupEntry | null => {
  if (!isRecord(value)) {
    return null;
  }

  const { trackId, bundleId, version, currentVersionReleaseDate } = value;

  if (
    typeof trackId !== "number" ||
    typeof bundleId !== "string" ||
    typeof version !== "string" ||
    typeof currentVersionReleaseDate !== "string"
  ) {
    return null;
  }

  return { trackId, bundleId, version, currentVersionReleaseDate };
};

/**
 * The entries of what the lookup answered, the body of a response being a
 * trust boundary: a body that is not a list of results, or an entry that has
 * not the type of each field the source reads, is refused as an invalid
 * document and never guessed at. What the entries say is for the source to
 * check.
 */
export const readLookupResponse = (body: unknown): AppStoreLookupResponse => {
  if (!isRecord(body) || !Array.isArray(body.results)) {
    throw invalidLookup(
      "The App Store lookup answered something that is not a list of results.",
    );
  }

  const results: AppStoreLookupEntry[] = [];

  for (const candidate of body.results) {
    const entry = readEntry(candidate);

    if (entry === null) {
      throw invalidLookup(
        "The App Store lookup answered an entry without a numeric trackId and the text of bundleId, version and currentVersionReleaseDate.",
      );
    }

    results.push(entry);
  }

  return { results };
};

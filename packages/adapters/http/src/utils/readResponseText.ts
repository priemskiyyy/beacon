import type { ManifestResponse } from "src/types/ManifestResponse";
import { invalidManifest } from "src/utils/invalidManifest";

/**
 * The text of a response, which is not read when it declares more than `bytes`.
 * A response with no declared length is read whole and its size is checked
 * when it is parsed: bound the transfer itself in your `fetch` to stop a
 * hostile stream early.
 */
export const readResponseText = async (
  response: ManifestResponse,
  bytes: number,
): Promise<string> => {
  if (Number(response.headers.get("content-length")) > bytes) {
    throw invalidManifest(`The manifest is larger than ${bytes} bytes.`);
  }

  return response.text();
};

/** Why a status that is not a document is no release decision, by status. */
export const REFUSED_STATUSES = new Map<number, string>([
  [204, "answered with no content, which is not a release decision"],
  [401, "requires authentication"],
  [403, "refused this client"],
  [404, "answered not found, which is not a release decision"],
  [429, "is limiting the rate of this client"],
]);

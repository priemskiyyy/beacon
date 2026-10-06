/** A property whose name contains one of these words is replaced whatever the raw toggle says, however deep it sits. */
export const SECRET_KEY =
  /token|authorization|password|passwd|pwd|secret|cookie|credential|api[-_]?key|private[-_]?key|bearer|jwt/i;

export const REDACTED = "[Redacted]";

export const TRUNCATED = "[Truncated]";

/** How much of a value is copied: the depth, the nodes in all, the entries of one object and the characters of one text. */
export const INSPECTION = { depth: 6, nodes: 200, entries: 50, text: 2_000 };

/** The characters of one event field or one line of the panel. */
export const FIELD_TEXT = 200;

/** The characters of a copied or expanded text. */
export const BLOCK_TEXT = 12_000;

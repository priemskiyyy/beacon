/** Why a lookup is refused: more than one entry answered a lookup for one app. */
export const AMBIGUOUS_LOOKUP =
  "The App Store lookup answered several entries for one app.";

/** Why a lookup is refused: the entry is another app than the one configured. */
export const APP_ID_MISMATCH =
  "The App Store lookup answered an entry for another app id.";

/** Why a lookup is refused: the entry belongs to another bundle than the one configured. */
export const BUNDLE_ID_MISMATCH =
  "The App Store lookup answered an entry for another bundle id.";

/** Why a lookup is refused: the entry has no version to compare. */
export const MISSING_VERSION =
  "The App Store lookup answered an entry with no version.";

/** Why a lookup is refused: the release date is not a date. */
export const MALFORMED_RELEASE_DATE =
  "The App Store lookup answered an entry with a malformed release date.";

/** Why construction is refused: an App Store id is a number. */
export const INVALID_APP_ID = "An App Store id is a string of digits.";

/** Why construction is refused: a storefront is a two-letter country code. */
export const INVALID_COUNTRY = "A storefront is a two-letter country code.";

/** Apple's documented lookup endpoint. It is not an availability guarantee, and its fields are not all present for every app. */
export const LOOKUP_URL = "https://itunes.apple.com/lookup";

/** What the versions name: a marketing release, not the exact native build a device receives. */
export const MARKETING_VERSION_DOMAIN = "apple-marketing-version";

/** The store page route, which redirects a user to the storefront of their account. */
export const STORE_URL = "https://apps.apple.com/app";

/** The key of a running release's raw facts that holds `CFBundleShortVersionString`. */
export const SHORT_VERSION_KEY = "shortVersion";

/** The only distribution an App Store route serves; TestFlight, enterprise and development builds are others. */
export const APP_STORE_DISTRIBUTION = "app-store";

/** The reason of the decision a lookup gives for another distribution. */
export const OTHER_DISTRIBUTION = "other-distribution";

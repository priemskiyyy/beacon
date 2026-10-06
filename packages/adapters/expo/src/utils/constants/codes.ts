/**
 * The codes `expo-updates` rejects with where it cannot run. A development
 * client reports `isEnabled` true and then refuses every call from native
 * code, as `ERR_NOT_AVAILABLE_IN_DEV_CLIENT`, and a debug build refuses it from
 * JavaScript, as `ERR_UPDATES_DISABLED`.
 */
export const UNAVAILABLE_CODES = new Set([
  "ERR_NOT_AVAILABLE_IN_DEV_CLIENT",
  "ERR_UPDATES_DISABLED",
]);

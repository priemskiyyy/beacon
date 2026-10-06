/**
 * The part of the `expo-application` module the reader uses: the version name
 * or marketing version, the version code or build number, and the application
 * id of the installed binary, each `null` where the platform has none, as on the
 * web. Pass the module itself: `import * as Application from "expo-application"`.
 * The reader never imports it, so a test passes a fake, and a server render
 * loads nothing. Do not read `expo-constants` instead: its manifest values can
 * come from an update, where these are fixed for a binary.
 *
 * @example
 * ```ts
 * import * as Application from "expo-application";
 *
 * const application: ApplicationLike = Application;
 * ```
 */
export type ApplicationLike = {
  nativeApplicationVersion: string | null;
  nativeBuildVersion: string | null;
  applicationId: string | null;
};

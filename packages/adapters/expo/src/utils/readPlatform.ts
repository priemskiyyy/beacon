import type { NativePlatform } from "src/types/NativePlatform";

/** The platform a scope names when a build number has a name for it, and `null` for any other, such as a web application's or a desktop shell's. */
export const readPlatform = (platform: string): NativePlatform | null => {
  if (platform === "android" || platform === "ios") {
    return platform;
  }

  return null;
};

import type { NativePlatform } from "src/types/NativePlatform";

/** What every native reader takes besides its SDK, all of it optional: the platform and the authority come from the scope of the read. */
export type NativeReaderOptions = {
  platform?: NativePlatform;
  authority?: string;
  domain?: string;
};

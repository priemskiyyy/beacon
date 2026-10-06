import type { DeviceInfoLike } from "src/types/DeviceInfoLike";
import type { NativeReaderOptions } from "src/types/NativeReaderOptions";

/**
 * Options for `deviceInfo()`: the `react-native-device-info` default export the
 * application imported, and the options every native reader takes.
 *
 * @example
 * ```ts
 * deviceInfo({
 *   deviceInfo: DeviceInfo,
 *   platform: "ios",
 *   authority: "com.example.notes",
 * });
 * ```
 */
export type DeviceInfoOptions = NativeReaderOptions & {
  deviceInfo: DeviceInfoLike;
};

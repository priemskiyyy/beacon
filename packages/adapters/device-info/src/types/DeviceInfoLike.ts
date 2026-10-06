/**
 * The part of `react-native-device-info` the reader uses, whose calls answer
 * at once and answer the text `unknown` where the native module has no value,
 * which the reader takes for a value that was not read. Pass its default
 * export: `import DeviceInfo from "react-native-device-info"`. The reader
 * never imports it, so a test passes a fake, and a server render loads
 * nothing.
 *
 * @example
 * ```ts
 * import DeviceInfo from "react-native-device-info";
 *
 * const deviceInfo: DeviceInfoLike = DeviceInfo;
 * ```
 */
export type DeviceInfoLike = {
  getVersion(): string;
  getBuildNumber(): string;
  getBundleId(): string;
};

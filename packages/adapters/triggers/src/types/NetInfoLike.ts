/**
 * The part of `@react-native-community/netinfo` the `reconnect` trigger uses.
 * Pass the module itself: `import NetInfo from "@react-native-community/netinfo"`.
 * NetInfo calls a new listener soon after it subscribes, with the state it
 * knows, and then on every change. The package never imports it.
 *
 * @example
 * ```ts
 * import NetInfo from "@react-native-community/netinfo";
 *
 * const back = reconnect({ netInfo: NetInfo });
 * ```
 */
export type NetInfoLike = {
  addEventListener(
    listener: (state: { isConnected: boolean | null }) => void,
  ): () => void;
};

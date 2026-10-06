import type { BeaconTrigger } from "src/triggers/types/BeaconTrigger";
import type { NetInfoLike } from "src/triggers/types/NetInfoLike";

/**
 * Checks when the network comes back, from `@react-native-community/netinfo`.
 * Only an observed change from not connected to connected is a reconnect:
 * NetInfo reports the state it knows as soon as it is subscribed to, and that
 * is not one, so nothing is checked at startup, and an unknown state is
 * neither. A reconnect does not wait out a backoff, and its check begins after
 * the read that may have met the dead network. It says the device is
 * connected, not that the authority is reachable. It subscribes to NetInfo's
 * state.
 *
 * @example
 * ```ts
 * import NetInfo from "@react-native-community/netinfo";
 *
 * checkOn(beacon, { triggers: [reconnect({ netInfo: NetInfo })] });
 * ```
 */
export const reconnect =
  ({ netInfo }: { netInfo: NetInfoLike }): BeaconTrigger =>
  (target) => {
    let connected: boolean | null = null;

    return netInfo.addEventListener(({ isConnected }) => {
      const before = connected;

      connected = isConnected;

      if (before !== false || isConnected !== true) {
        return;
      }

      target.signal("reconnect");
    });
  };

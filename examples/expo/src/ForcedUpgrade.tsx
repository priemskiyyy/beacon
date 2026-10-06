import { useBeacon, useSupport } from "@priemskiyyy/beacon-react";
import type { PropsWithChildren } from "react";
import { Button, Text, View } from "react-native";

export const ForcedUpgrade = ({ children }: PropsWithChildren) => {
  const beacon = useBeacon();
  const unsupported = useSupport(({ status }) => status === "unsupported");

  if (!unsupported) {
    return children;
  }

  return (
    <View>
      <Text>This version is no longer supported.</Text>
      <Button
        title="Update from the store"
        onPress={() => beacon.route("store").openStore()}
      />
    </View>
  );
};

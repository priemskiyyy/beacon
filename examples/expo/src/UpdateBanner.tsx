import { applyUpdate } from "@priemskiyyy/beacon-expo";
import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { useState } from "react";
import { Button, Text, View } from "react-native";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const { observation } = useRoute("ota");
  const [notice, setNotice] = useState<string | null>(null);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const applied = await applyUpdate(beacon.route("ota"));

    if (applied.step !== "reload" || applied.outcome.status !== "blocked") {
      return;
    }

    setNotice("Save your note, then update.");
  };

  return (
    <View>
      <Text>A new version is ready.</Text>
      {notice !== null && <Text>{notice}</Text>}
      <Button title="Update" onPress={update} />
    </View>
  );
};

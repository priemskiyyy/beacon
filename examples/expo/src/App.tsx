import { checkOn, foreground } from "@priemskiyyy/beacon/triggers";
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";
import { AppState, View } from "react-native";

import { beacon } from "./beacon";
import { DraftForm } from "./DraftForm";
import { ForcedUpgrade } from "./ForcedUpgrade";
import { UpdateBanner } from "./UpdateBanner";

export const App = () => {
  // Checks when the app starts and each time it returns from the background.
  useEffect(
    () => checkOn(beacon, { triggers: [foreground({ appState: AppState })] }),
    [],
  );

  return (
    <BeaconProvider beacon={beacon}>
      <View style={{ flex: 1, gap: 16, padding: 24, paddingTop: 64 }}>
        <ForcedUpgrade>
          <UpdateBanner />
          <DraftForm />
        </ForcedUpgrade>
      </View>
    </BeaconProvider>
  );
};

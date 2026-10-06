import { checkOn } from "@priemskiyyy/beacon/triggers";
import { foreground, reconnect } from "@priemskiyyy/beacon/triggers/browser";
import { BeaconProvider } from "@priemskiyyy/beacon-react";
import { useEffect } from "react";

import { beacon } from "./beacon";
import { DraftForm } from "./DraftForm";
import { UpdateBanner } from "./UpdateBanner";

export const App = () => {
  // Checks when the page loads, when its tab is shown again and when the network comes back.
  useEffect(
    () => checkOn(beacon, { triggers: [foreground(), reconnect()] }),
    [],
  );

  return (
    <BeaconProvider beacon={beacon}>
      <h1>Notes</h1>
      <p>Build {import.meta.env.VITE_BUILD_ID}</p>
      <UpdateBanner />
      <DraftForm />
    </BeaconProvider>
  );
};

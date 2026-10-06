import { useBeacon, useRoute } from "@priemskiyyy/beacon-react";
import { useState } from "react";

export const UpdateBanner = () => {
  const beacon = useBeacon();
  const { observation } = useRoute("web");
  const [notice, setNotice] = useState<string | null>(null);

  if (observation.status !== "available") {
    return null;
  }

  const update = async () => {
    const outcome = await beacon
      .route("web")
      .reload({ offer: observation.offer });

    if (outcome.status !== "blocked") {
      return;
    }

    setNotice("Save your note, then update.");
  };

  return (
    <div role="status">
      <p>A new version is ready.</p>
      {notice !== null && <p>{notice}</p>}
      <button onClick={update}>Update</button>
    </div>
  );
};

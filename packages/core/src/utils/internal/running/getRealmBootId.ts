import { createBootId } from "src/utils/createBootId";

// One per module instance, so one per JavaScript realm: the Beacons a Fast Refresh makes again are the same boot.
let realmBootId: string | null = null;

/** The boot id of this JavaScript realm, minted on first use and shared by every Beacon that is not given one. */
export const getRealmBootId = (): string => {
  if (realmBootId === null) {
    realmBootId = createBootId();
  }

  return realmBootId;
};

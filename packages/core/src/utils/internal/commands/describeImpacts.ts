import type { Impact } from "src/types/Impact";
import { IMPACT_EFFECTS } from "src/utils/constants/commands";

/** What a command's impacts add up to for the coordinator. */
export const describeImpacts = (impacts: Impact[]) => ({
  disruptive: impacts.some((impact) => IMPACT_EFFECTS[impact].disruptive),
  replacesRealm: impacts.some((impact) => IMPACT_EFFECTS[impact].replacesRealm),
});

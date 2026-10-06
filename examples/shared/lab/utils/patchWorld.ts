import type { LabWorld } from "example-shared/lab/types/LabWorld";
import type { ValueStore } from "example-shared/types/ValueStore";

export const patchWorld = (
  world: ValueStore<LabWorld>,
  patch: Partial<LabWorld>,
) => {
  world.set({ ...world.get(), ...patch });
};

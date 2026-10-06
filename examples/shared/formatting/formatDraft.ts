import type { LabDraft } from "example-shared/lab/types/LabDraft";

export const formatDraft = ({ dirty, locked }: LabDraft) => {
  if (locked) {
    return "locked by the reload";
  }

  if (dirty) {
    return "unsaved changes";
  }

  return "saved";
};

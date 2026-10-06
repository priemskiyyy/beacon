import type { DisruptionParticipant } from "@priemskiyyy/beacon";

import { UNSAVED_DRAFT } from "example-shared/lab/constants/lab";
import type { LabDraft } from "example-shared/lab/types/LabDraft";
import type { ValueStore } from "example-shared/types/ValueStore";

/**
 * The application's unsaved work as a participant: an unsaved draft refuses
 * the reload before anything is asked of the browser, and a reservation locks
 * the draft until it is released, so nothing new is typed into a document that
 * is about to be replaced.
 */
export const createDraftParticipant = (
  draft: ValueStore<LabDraft>,
): DisruptionParticipant => ({
  name: "draft-editor",
  impacts: ["document-replacement"],
  reserve: () => {
    if (draft.get().dirty) {
      return { status: "blocked", code: UNSAVED_DRAFT };
    }

    draft.set({ ...draft.get(), locked: true });

    return {
      status: "reserved",
      resume: () => draft.set({ ...draft.get(), locked: false }),
    };
  },
});

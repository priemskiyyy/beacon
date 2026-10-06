// Typechecked, never run: each `@ts-expect-error` is a rule the types enforce
// so that a participant's answer is not checked again at runtime.
import type { DisruptionParticipant } from "src/types/DisruptionParticipant";
import type { ReserveResult } from "src/types/ReserveResult";

// A guard that names nothing is asked before every impact that loses in-memory state, and reopens nothing.
export const guard: DisruptionParticipant = {
  name: "drafts",
  reserve: () => ({ status: "reserved" }),
};

export const narrowed: DisruptionParticipant = {
  name: "uploads",
  impacts: ["native-update-flow"],
  reserve: () => ({ status: "reserved", resume: () => {} }),
};

export const settling: ReserveResult = {
  status: "reserved",
  settle: async () => ({ status: "ready" }),
};

export const misnamed: ReserveResult = {
  status: "reserved",
  // @ts-expect-error The function that reopens admission is `resume`, which cannot be taken for a `Release` of a route.
  release: () => {},
};

export const unknownImpact: DisruptionParticipant = {
  name: "drafts",
  // @ts-expect-error An impact is one of the ones a command declares.
  impacts: ["reload"],
  reserve: () => ({ status: "reserved" }),
};

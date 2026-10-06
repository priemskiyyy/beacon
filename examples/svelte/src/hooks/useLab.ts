import { getContext } from "svelte";

import type { ReleaseLab } from "example-shared/lab/types/ReleaseLab";
import { LAB_CONTEXT } from "src/utils/constants/labContext";

/** The lab the page was mounted with; the components read it, and it never changes. */
export const useLab = () => {
  const lab = getContext<ReleaseLab | undefined>(LAB_CONTEXT);

  if (lab === undefined) {
    throw new Error("useLab needs the lab to be mounted as context.");
  }

  return lab;
};

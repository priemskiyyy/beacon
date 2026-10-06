import { createUpdateMechanism } from "@priemskiyyy/beacon";
import type { ProviderResult } from "@priemskiyyy/beacon";

import type { LabNative } from "example-shared/lab/types/LabNative";
import type { ReloadReceipt } from "example-shared/lab/types/ReloadReceipt";

/**
 * The lab's browser reload. Like the browser adapter's, it requests a
 * navigation and claims nothing more: the next document may run another
 * build, the same one, or never arrive, and only that boot shows it.
 */
export const createReloadMechanism = (browser: LabNative) =>
  createUpdateMechanism({
    name: "lab-reload",
    subject: "web",
    open: () => ({ native: browser }),
    commands: {
      reload: {
        reference: "offer",
        impacts: ["document-replacement"],
        binding: "unpinned-navigation",
        run: async ({ native }): Promise<ProviderResult<ReloadReceipt>> => {
          native.reload();

          return { status: "accepted", receipt: { kind: "reload-requested" } };
        },
      },
    },
  });

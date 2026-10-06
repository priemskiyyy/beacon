import type { RunningRelease } from "@priemskiyyy/beacon";

import { formatValueText } from "src/formatting/formatValueText";
import { inspectValue } from "src/utils/inspectValue";

/** The raw values a platform reported for what is running, copied and bounded, with secret-named properties replaced. */
export const formatRaw = (raw: RunningRelease["raw"]) =>
  formatValueText(inspectValue(raw));

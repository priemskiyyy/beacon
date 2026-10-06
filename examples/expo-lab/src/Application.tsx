import type React from "react";

import { LabApplication } from "src/components/Lab/LabApplication";
import { NativeApplication } from "src/components/Native/NativeApplication";
import type { ExpoStart } from "src/lab/types/ExpoStart";

type ApplicationProps = { start: ExpoStart };

export const Application: React.FunctionComponent<ApplicationProps> = ({
  start,
}) => {
  if (start.kind === "lab") {
    return <LabApplication lab={start.lab} runtime={start.runtime} />;
  }

  return (
    <NativeApplication
      beacon={start.beacon}
      diagnostics={start.diagnostics}
      runtime={start.runtime}
    />
  );
};

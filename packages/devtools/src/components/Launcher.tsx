import type { BeaconStatus } from "@priemskiyyy/beacon";

import { BeaconIcon } from "src/components/BeaconIcon";
import { useAutoFocus } from "src/hooks/useAutoFocus";

type LauncherProps = {
  status: BeaconStatus["state"];
  hasUnseenFailure: boolean;
  autoFocus: boolean;
  onOpen: () => void;
};

/** The closed panel: a button that says where the session stands and turns red when a failure arrived while it was closed. */
export const Launcher = (props: LauncherProps) => {
  const focusOnMount = useAutoFocus(props.autoFocus);

  return (
    <button
      ref={focusOnMount}
      type="button"
      class="launcher"
      aria-label="Open Beacon devtools"
      onClick={() => props.onOpen()}
    >
      <BeaconIcon />
      <span>Beacon</span>
      <span
        class="dot"
        data-state={props.hasUnseenFailure ? "failure" : props.status}
      />
    </button>
  );
};

import type { WebBeacon } from "src/beacon.fixture";
import { BeaconProvider } from "src/context/BeaconProvider";
import { useRoute } from "src/primitives/useRoute";
import { useRunning } from "src/primitives/useRunning";

const Status = () => {
  const observation = useRoute("web", ({ observation }) => observation.status);
  const running = useRunning(({ web }) => web.state);

  return <span>{`${observation()}/${running()}`}</span>;
};

// The application's root: one provider that holds the session, and a view of the route and of what runs.
export const StatusView = (props: { beacon: WebBeacon }) => (
  <BeaconProvider beacon={props.beacon} start>
    <Status />
  </BeaconProvider>
);

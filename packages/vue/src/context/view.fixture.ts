import { createSSRApp, defineComponent, h } from "vue";

import { createWebBeacon } from "src/beacon.fixture";
import { useRoute } from "src/composables/useRoute";
import { useRunning } from "src/composables/useRunning";
import { BeaconProvider } from "src/context/BeaconProvider";

// A Beacon over a web route, and a view that reads it below a provider that starts the session.
export const createView = () => {
  const context = createWebBeacon();

  const View = defineComponent(() => {
    const observation = useRoute(
      "web",
      ({ observation }) => observation.status,
    );

    const running = useRunning(({ web }) => web.state);

    return () => h("span", `${observation.value}/${running.value}`);
  });

  const createApp = () =>
    createSSRApp(() =>
      h(BeaconProvider, { beacon: context.beacon, start: true }, () => h(View)),
    );

  return { ...context, createApp };
};

import { createApp, defineComponent, h, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";

import type { WebBeacon } from "src/beacon.fixture";
import { BeaconProvider } from "src/context/BeaconProvider";

export type Provision = {
  beacon: MaybeRefOrGetter<WebBeacon>;
  start?: MaybeRefOrGetter<boolean>;
};

// Mounts a component whose setup runs `read`, under a provider when one is given, and keeps what Vue warned about.
export const mount = <TValue>(read: () => TValue, provision?: Provision) => {
  const warnings: string[] = [];
  const captured: { current?: { value: TValue } } = {};

  const Probe = defineComponent(() => {
    captured.current = { value: read() };

    return () => null;
  });

  const Root = defineComponent(() => () => {
    if (provision === undefined) {
      return h(Probe);
    }

    const { beacon, start = false } = provision;

    return h(
      BeaconProvider,
      { beacon: toValue(beacon), start: toValue(start) },
      () => h(Probe),
    );
  });

  const app = createApp(Root);

  app.config.warnHandler = (message) => {
    warnings.push(message);
  };

  app.mount(document.createElement("div"));

  if (captured.current === undefined) {
    throw new Error("The probe was never set up.");
  }

  return {
    value: captured.current.value,
    warnings,
    unmount: () => app.unmount(),
  };
};

import { expect, test } from "vitest";
import { createSSRApp, defineComponent, h } from "vue";
import { renderToString } from "vue/server-renderer";

import { countListeners, createWebBeacon, settle } from "src/beacon.fixture";
import { useDisruption } from "src/composables/useDisruption";
import { useObservable } from "src/composables/useObservable";
import { BeaconProvider } from "src/context/BeaconProvider";
import { createView } from "src/context/view.fixture";

const MARKUP = "<!--[--><span>unknown/pending</span><!--]-->";

test("the server renders the route as not checked and what runs as pending, and starts nothing", async () => {
  expect(typeof window).toBe("undefined");

  const { beacon, createApp, mock } = createView();

  expect(await renderToString(createApp())).toBe(MARKUP);
  expect(beacon.status.get()).toEqual({ state: "idle" });
  expect(mock.stats().reads).toBe(0);
});

test("the server renders what the Beacon was before any session, whatever it knows now", async () => {
  const { beacon, createApp } = createView();

  beacon.start();
  await settle();

  expect(beacon.running.get().web.state).toBe("known");
  expect(await renderToString(createApp())).toBe(MARKUP);
});

test("the server subscribes to nothing", async () => {
  const { beacon } = createWebBeacon();
  const counted = countListeners(beacon.route("web").state);

  const View = defineComponent(() => {
    const state = useObservable(counted.observable);

    return () => h("span", state.value.observation.status);
  });

  const app = createSSRApp(() =>
    h(BeaconProvider, { beacon, start: true }, () => h(View)),
  );

  expect(await renderToString(app)).toBe(
    "<!--[--><span>unknown</span><!--]-->",
  );
  expect(counted.listeners()).toBe(0);
});

test("the server registers no disruption participant", async () => {
  const { beacon } = createWebBeacon();

  const View = defineComponent(() => {
    useDisruption({
      name: "draft-editor",
      impacts: ["document-replacement"],
      reserve: () => ({ status: "blocked", code: "unsaved-draft" }),
    });

    return () => h("span");
  });

  const app = createSSRApp(() =>
    h(BeaconProvider, { beacon, start: true }, () => h(View)),
  );

  await renderToString(app);
  beacon.start();

  await expect(beacon.route("web").prefetch()).resolves.toMatchObject({
    status: "accepted",
  });
});

test("BIND-09 two server requests for different accounts share no session and no state", async () => {
  const first = createView();
  const second = createView();

  first.beacon.start();

  expect(await renderToString(second.createApp())).toBe(MARKUP);
  expect(second.beacon.status.get()).toEqual({ state: "idle" });
  expect(first.beacon.status.get()).toMatchObject({ state: "running" });
  expect(second.mock.stats().reads).toBe(0);
});

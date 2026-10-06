import { createApp } from "vue";

import { createReleaseLab } from "example-shared/lab/createReleaseLab";
import {
  REQUEST_LATENCY,
  TICK_INTERVAL,
} from "example-shared/lab/constants/lab";
import Application from "src/Application.vue";
import "src/styles.css";

const root = document.getElementById("root");

if (root === null) {
  throw new Error("The page has no #root element.");
}

// `?latency=0` makes the release service answer at once.
const parameters = new URLSearchParams(window.location.search);

const lab = createReleaseLab({
  tick: TICK_INTERVAL,
  latency: Number(parameters.get("latency") ?? REQUEST_LATENCY),
});

createApp(Application, { lab }).mount(root);

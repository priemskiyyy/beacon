import { match } from "ts-pattern";

import type { WorldEvent } from "example-shared/lab/types/WorldEvent";

const formatSeconds = (milliseconds: number) =>
  `${(milliseconds / 1_000).toFixed(1)} s`;

export const formatWorldEvent = (event: WorldEvent) =>
  match(event)
    .with(
      { type: "booted" },
      ({ build }) => `A new document boots and runs build ${build}`,
    )
    .with({ type: "published" }, ({ build }) => `Build ${build} is published`)
    .with(
      { type: "required" },
      ({ build }) =>
        `Build ${build} is published and required: older builds are unsupported`,
    )
    .with(
      { type: "rolled-back" },
      ({ build }) => `The deployment rolls back to build ${build}`,
    )
    .with({ type: "no-update" }, () => "The service says it has nothing")
    .with(
      { type: "ended" },
      ({ build }) => `Support for build ${build} has ended`,
    )
    .with(
      { type: "manifest-failing", failing: true },
      () => "The release service starts failing",
    )
    .with(
      { type: "manifest-failing", failing: false },
      () => "The release service recovers",
    )
    .with(
      { type: "manifest-slow", slow: true },
      () => "The release service starts holding its answers",
    )
    .with(
      { type: "manifest-slow", slow: false },
      () => "The release service answers at once again",
    )
    .with(
      { type: "manifest-answered" },
      ({ reads }) =>
        `The service answers ${reads} held read${reads === 1 ? "" : "s"}`,
    )
    .with(
      { type: "time-skipped" },
      ({ milliseconds }) =>
        `The clock moves ahead ${formatSeconds(milliseconds)}`,
    )
    .with({ type: "draft", dirty: true }, () => "The draft has unsaved changes")
    .with({ type: "draft", dirty: false }, () => "The draft is saved")
    .with(
      { type: "deployment-lagging", lagging: true },
      () => "The deployment lags: new documents still load the old build",
    )
    .with(
      { type: "deployment-lagging", lagging: false },
      () => "The deployment catches up",
    )
    .with({ type: "reload-requested" }, () => "The browser is asked to reload")
    .with({ type: "reset" }, () => "The lab starts again")
    .exhaustive();

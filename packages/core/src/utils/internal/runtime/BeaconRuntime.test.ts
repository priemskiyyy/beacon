import { expect, test, vi } from "vitest";

import type { BeaconDiagnosticEventType } from "src/types/BeaconDiagnosticEventType";
import type { Session } from "src/types/internal/Session";
import { Listeners } from "src/utils/internal/observable/Listeners";
import { BeaconRuntime } from "src/utils/internal/runtime/BeaconRuntime";

type Hooks = {
  onStart: (session: Session) => void;
  record: (type: BeaconDiagnosticEventType) => void;
};

// A runtime that logs what it publishes, records and opens, in order, and lets a test hook into each.
const createRuntime = (hooks: Partial<Hooks> = {}) => {
  const log: string[] = [];
  const reported = vi.fn();

  const runtime = new BeaconRuntime({
    listeners: new Listeners(reported),
    onStart: (session) => {
      log.push(`open ${session.id}`);
      hooks.onStart?.(session);
    },
    onDispose: () => log.push("dispose"),
    record: (type) => {
      log.push(type);
      hooks.record?.(type);
    },
    reportCleanupError: reported,
  });

  runtime.status.subscribe(() => {
    log.push(`status ${runtime.status.get().state}`);
  });

  return { runtime, log, reported };
};

test("starting records the session, publishes it running, then opens it", () => {
  const { runtime, log } = createRuntime();

  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "running", session: 1 });
  expect(runtime.getSession()).toMatchObject({ id: 1 });
  expect(log).toEqual(["session-started", "status running", "open 1"]);
});

test("LIFE-03 starting again while open answers the same stop and opens nothing more", () => {
  const { runtime, log } = createRuntime();
  const stop = runtime.start();

  expect(runtime.start()).toBe(stop);
  expect(log.filter((entry) => entry.startsWith("open"))).toEqual(["open 1"]);
});

test("LIFE-02 a stop ends its own session once, and never one that came after it", () => {
  const { runtime, log } = createRuntime();
  const first = runtime.start();

  first();
  first();
  runtime.stop();

  expect(runtime.status.get()).toEqual({ state: "stopped" });
  expect(log.filter((entry) => entry === "session-stopped")).toHaveLength(1);

  runtime.start();
  first();

  expect(runtime.status.get()).toEqual({ state: "running", session: 2 });
  expect(runtime.getSession()).toMatchObject({ id: 2 });
});

test("the cleanups of a session run before its stop is published", () => {
  const { runtime, log } = createRuntime({
    onStart: (session) => {
      session.scope.add(() => log.push("cleanup"));
    },
  });

  runtime.start();
  runtime.stop();

  expect(log.slice(-3)).toEqual([
    "session-stopped",
    "cleanup",
    "status stopped",
  ]);
});

test("a listener of the event that ends the session while it starts leaves it stopped, and never running", () => {
  const { runtime, log } = createRuntime({
    record: (type) => {
      if (type !== "session-started") {
        return;
      }

      runtime.stop();
    },
  });

  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "stopped" });
  expect(runtime.getSession()).toBeNull();
  expect(log).not.toContain("status running");
  expect(log).not.toContain("open 1");
});

test("a status listener that ends the session while it starts leaves nothing open", () => {
  const { runtime, log } = createRuntime();

  runtime.status.subscribe(() => runtime.stop());
  runtime.start();

  expect(runtime.status.get()).toEqual({ state: "stopped" });
  expect(log).not.toContain("open 1");
});

test("a cleanup that starts the next session leaves that session running", () => {
  let restarted = false;

  const { runtime, log } = createRuntime({
    onStart: (session) => {
      session.scope.add(() => {
        if (restarted) {
          return;
        }

        restarted = true;
        runtime.start();
      });
    },
  });

  runtime.start();
  runtime.stop();

  expect(runtime.status.get()).toEqual({ state: "running", session: 2 });
  expect(runtime.getSession()).toMatchObject({ id: 2 });
  expect(log.filter((entry) => entry === "status stopped")).toHaveLength(0);
});

test("a cleanup that disposes leaves the Beacon disposed, and disposes it once", () => {
  const { runtime, log } = createRuntime({
    onStart: (session) => {
      session.scope.add(() => runtime.dispose());
    },
  });

  runtime.start();
  runtime.stop();

  expect(runtime.status.get()).toEqual({ state: "disposed" });
  expect(log.filter((entry) => entry === "dispose")).toHaveLength(1);
});

test("disposing ends the open session, publishes the stop and then the end, and closes once", () => {
  const { runtime, log } = createRuntime();

  runtime.start();
  runtime.dispose();
  runtime.dispose();

  expect(runtime.status.get()).toEqual({ state: "disposed" });
  expect(log.slice(3)).toEqual([
    "session-stopped",
    "status stopped",
    "status disposed",
    "dispose",
  ]);
});

test("a listener of the stopped status that starts another session while disposing has it ended too", () => {
  const { runtime } = createRuntime();

  let restarts = 0;

  runtime.status.subscribe(() => {
    if (runtime.status.get().state !== "stopped" || restarts > 0) {
      return;
    }

    restarts += 1;
    runtime.start();
  });
  runtime.start();
  runtime.dispose();

  expect(runtime.status.get()).toEqual({ state: "disposed" });
  expect(runtime.getSession()).toBeNull();
});

test("a disposed runtime refuses to start, and stopping it does nothing", () => {
  const { runtime } = createRuntime();

  runtime.dispose();
  runtime.stop();

  expect(() => runtime.start()).toThrow(
    expect.objectContaining({ code: "DISPOSED" }),
  );
  expect(runtime.status.get()).toEqual({ state: "disposed" });
});

test("a cleanup that throws is reported and the session still ends", () => {
  const { runtime, reported } = createRuntime({
    onStart: (session) => {
      session.scope.add(() => {
        throw new Error("cleanup");
      });
    },
  });

  runtime.start();
  runtime.stop();

  expect(reported).toHaveBeenCalledTimes(1);
  expect(runtime.status.get()).toEqual({ state: "stopped" });
});

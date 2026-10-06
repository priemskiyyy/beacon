import { BeaconError } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { fakeBridge } from "src/fakeBridge.fixture";
import { PlaySession } from "src/utils/PlaySession";

const open = () => {
  const { bridge } = fakeBridge();
  const native = { bridge };

  const session = new PlaySession({
    native,
    application: "com.example.notes",
    emit: { observation: () => {}, prepared: () => {}, progress: () => {} },
  });

  return { native, session };
};

test("a session is found by the handle it opened, until it is disposed", () => {
  const { native, session } = open();

  expect(PlaySession.of(native)).toBe(session);

  session.dispose();

  expect(() => PlaySession.of(native)).toThrow(BeaconError);
});

test("a handle no session opened is a provider that is not open", () => {
  const { bridge } = fakeBridge();

  expect(() => PlaySession.of({ bridge })).toThrow(
    expect.objectContaining({ code: "DRIVER_FAILED" }),
  );
});

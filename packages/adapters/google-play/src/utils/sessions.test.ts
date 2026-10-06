import { BeaconError } from "@priemskiyyy/beacon";
import { expect, test } from "vitest";

import { fakeBridge } from "src/fakeBridge.fixture";
import { PlaySession } from "src/utils/PlaySession";
import { bindSession, getSession } from "src/utils/sessions";

const open = () => {
  const { bridge } = fakeBridge();

  const session = new PlaySession({
    bridge,
    application: "com.example.notes",
    emit: { observation: () => {}, prepared: () => {}, progress: () => {} },
  });

  return { native: { bridge }, session };
};

test("a session is found by the handle it is bound to, until it is unbound", () => {
  const { native, session } = open();
  const unbind = bindSession(native, session);

  expect(getSession(native)).toBe(session);

  unbind();

  expect(() => getSession(native)).toThrow(BeaconError);
});

test("a handle no session owns is a provider that is not open", () => {
  const { native } = open();

  expect(() => getSession(native)).toThrow(
    expect.objectContaining({ code: "DRIVER_FAILED" }),
  );
});

import { expect, test } from "vitest";

import { askUpdates } from "src/utils/askUpdates";

test("an answer is passed on", async () => {
  await expect(askUpdates(async () => 5)).resolves.toEqual({
    status: "answered",
    value: 5,
  });
});

test.each(["ERR_NOT_AVAILABLE_IN_DEV_CLIENT", "ERR_UPDATES_DISABLED"])(
  "a rejection with the code %s is a refusal, not a failure",
  async (code) => {
    await expect(
      askUpdates(async () => {
        throw Object.assign(new Error("refused"), { code });
      }),
    ).resolves.toEqual({ status: "refused" });
  },
);

test.each([
  ["an error with another code", Object.assign(new Error("x"), { code: "E" })],
  ["an error without a code", new Error("x")],
  [
    "an error whose code is not a text",
    Object.assign(new Error("x"), { code: 7 }),
  ],
  ["a text", "ERR_UPDATES_DISABLED"],
  ["null", null],
])("%s is a failure, thrown on as it was raised", async (_name, failure) => {
  await expect(
    askUpdates(async () => {
      throw failure;
    }),
  ).rejects.toBe(failure);
});

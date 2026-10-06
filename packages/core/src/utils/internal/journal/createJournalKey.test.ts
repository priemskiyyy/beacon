import { expect, test } from "vitest";

import { createJournalKey } from "src/utils/internal/journal/createJournalKey";

const scope = {
  application: "com.example.notes",
  environment: "production",
  platform: "web",
  distribution: "public-web",
};

test("the key is partitioned by every part of the scope", () => {
  expect(createJournalKey(scope)).toBe(
    "beacon/v1/com.example.notes/production/web/public-web",
  );

  const parts: Array<keyof typeof scope> = [
    "application",
    "environment",
    "platform",
    "distribution",
  ];

  for (const part of parts) {
    expect(createJournalKey({ ...scope, [part]: "other" })).not.toBe(
      createJournalKey(scope),
    );
  }
});

test("a part that contains a separator cannot reach into another scope's key", () => {
  expect(
    createJournalKey({ ...scope, environment: "production/web" }),
  ).not.toBe(
    createJournalKey({
      ...scope,
      environment: "production",
      platform: "web/web",
    }),
  );
});

test("an account partition is part of the key, and no partition is not an empty one", () => {
  expect(createJournalKey({ ...scope, partition: "user-42" })).toBe(
    "beacon/v1/com.example.notes/production/web/public-web/user-42",
  );
  expect(createJournalKey({ ...scope, partition: "" })).not.toBe(
    createJournalKey(scope),
  );
  expect(createJournalKey({ ...scope, partition: "user-1" })).not.toBe(
    createJournalKey({ ...scope, partition: "user-2" }),
  );
});

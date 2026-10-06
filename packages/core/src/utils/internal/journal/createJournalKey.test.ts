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

test("text that is not well formed still makes a key, and no other scope shares it", () => {
  const keys = ["user-", "user-\uD800", "user-\uDC00", "user-�", "user-😀"].map(
    (partition) => createJournalKey({ ...scope, partition }),
  );

  expect(new Set(keys).size).toBe(keys.length);
  expect(keys[1]).toBe(
    "beacon/v1/com.example.notes/production/web/public-web/user-%ED%A0%80",
  );
  expect(keys[4]).toBe(
    "beacon/v1/com.example.notes/production/web/public-web/user-%F0%9F%98%80",
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

import {
  testJournalStorage,
  testRunningReader,
  testUpdateMechanism,
} from "@priemskiyyy/beacon/testing";

import { browserReload } from "src/browserReload";
import { browserStorage } from "src/browserStorage";
import { APPLICATION, fakeWindow } from "src/fakeWindow.fixture";
import { fakeStorageWindow } from "src/fakeStorage.fixture";
import type { BrowserStorageArea } from "src/types/BrowserStorageArea";
import { webBuild } from "src/webBuild";

testUpdateMechanism({
  name: "browser-reload",
  create: () => ({ mechanism: browserReload({ target: fakeWindow() }) }),
});

const AREAS: BrowserStorageArea[] = ["session", "local"];

for (const area of AREAS) {
  testJournalStorage({
    name: `browser ${area}Storage`,
    create: () => {
      const { window } = fakeStorageWindow();
      const open = () => browserStorage({ area, target: window });

      return { storage: open(), reopen: open };
    },
  });
}

const createBuild = (id: string | null | undefined) => ({
  reader: webBuild({ authority: APPLICATION, id }),
});

testRunningReader({
  name: "web build",
  create: () => createBuild("a91b44e"),
  situations: [
    {
      name: "the bundler injected nothing",
      answers: "unknown",
      create: () => createBuild(undefined),
    },
    {
      name: "the bundler injected an empty id",
      answers: "unknown",
      create: () => createBuild(""),
    },
    {
      name: "the bundler wrote the text undefined",
      answers: "unknown",
      create: () => createBuild("undefined"),
    },
  ],
});

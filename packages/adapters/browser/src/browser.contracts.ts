// Typechecked, never run: the real DOM window satisfies the structural types
// the adapter uses, and a route's methods are derived from the commands the
// mechanism declares.
import { createReleaseSource, targetRoute } from "@priemskiyyy/beacon";
import type {
  JournalStorage,
  KeyValueStoreLike,
  NoneDecision,
  OfferReference,
  PreparedReference,
  RouteHandle,
  RunningReaders,
  TargetDecision,
} from "@priemskiyyy/beacon";
import { expectTypeOf } from "vitest";

import { browserReload } from "src/browserReload";
import { browserStorage } from "src/browserStorage";
import type { BrowserNative } from "src/types/BrowserNative";
import type { BrowserReloadReceipt } from "src/types/BrowserReloadReceipt";
import type { BrowserStorageWindowLike } from "src/types/BrowserStorageWindowLike";
import type { BrowserWindowLike } from "src/types/BrowserWindowLike";
import { webBuild } from "src/webBuild";

export const target: BrowserWindowLike = window;

export const mechanism = browserReload({ target: window });

// @ts-expect-error -- an object without a location is not a window.
browserReload({ target: { navigator: {} } });

const manifest = createReleaseSource<{ web: TargetDecision | NoneDecision }>({
  name: "manifest",
  read: async () => {
    throw new Error("Never run.");
  },
});

export const routes = {
  web: targetRoute({
    subject: "web",
    source: manifest.select((document) => document.web),
    mechanism,
  }),
};

declare const web: RouteHandle<"web", typeof routes.web>;

declare const offer: OfferReference<"web">;

declare const prepared: PreparedReference<"web">;

export const outcome = web.reload({ offer });

// @ts-expect-error -- a reload needs the offer the user was shown.
web.reload();

// WEB-07 A hard reload is not an option of the reload command, so no portable guarantee of one is made.
// @ts-expect-error -- there is no hard reload.
web.reload({ offer, hard: true });

// @ts-expect-error -- a prepared reference never fits where an offer is asked for.
web.reload({ offer: prepared });

// BIND-05 The native handle of a typed route is the provider's own type, without an assertion.
expectTypeOf(web.native.get()).toEqualTypeOf<BrowserNative | null>();

export const receipt = async () => {
  const settled = await web.reload({ offer });

  if (settled.status === "accepted") {
    expectTypeOf(settled.receipt).toEqualTypeOf<BrowserReloadReceipt>();

    // @ts-expect-error -- an accepted reload proves no update.
    return settled.receipt.updated;
  }

  return null;
};

// The real Web Storage and the real window fit what the journal's storage asks of them.
expectTypeOf(window.sessionStorage).toExtend<KeyValueStoreLike>();
expectTypeOf(window.localStorage).toExtend<KeyValueStoreLike>();

export const storageTarget: BrowserStorageWindowLike = window;

export const journalStorage: JournalStorage = browserStorage();

export const localJournalStorage = browserStorage({
  area: "local",
  target: window,
  verify: false,
});

// @ts-expect-error -- web storage has a session area and a local one, and nothing else.
browserStorage({ area: "cookie" });

// @ts-expect-error -- a window that only reloads has no storage.
browserStorage({ target: { location: { reload: () => {} } } });

// @ts-expect-error -- both areas are asked of the window, since the area is chosen when the journal asks.
browserStorage({ target: { sessionStorage: window.sessionStorage } });

export const webReader: RunningReaders["web"] = webBuild({
  authority: "com.example.notes",
  id: undefined,
});

// A define the bundler may leave out is undefined or null, and is told apart from a build, so each is accepted.
export const nullable = webBuild({ authority: "a", id: null, label: null });

// @ts-expect-error -- the id is required, so a build cannot name none by leaving it out.
webBuild({ authority: "com.example.notes" });

// @ts-expect-error -- the authority is who assigns the ids, so it is required.
webBuild({ id: "a91b44e" });

// @ts-expect-error -- a build id is text.
webBuild({ authority: "com.example.notes", id: 7 });

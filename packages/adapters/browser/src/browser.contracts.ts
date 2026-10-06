// Typechecked, never run: the real DOM window satisfies the structural types
// the adapter uses, and a route's methods are derived from the commands the
// mechanism declares.
import { targetRoute } from "@priemskiyyy/beacon";
import { createReleaseSource } from "@priemskiyyy/beacon/adapter";
import type {
  JournalStorage,
  KeyValueStoreLike,
  NoneDecision,
  OfferReference,
  PreparedReference,
  Release,
  RouteHandle,
  RunningReader,
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
import { webRelease } from "src/webRelease";

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

// The authority is the scope's application, so the id is all a build needs.
export const scoped: RunningReader<"web"> = webBuild({
  id: "a91b44e",
});

export const slots: RunningReaders = {
  web: scoped,
  // @ts-expect-error -- the reader of the web build is made for the web subject, not the bundle.
  bundle: scoped,
};

// A define the bundler may leave out is undefined or null, and is told apart from a build, so each is accepted.
export const nullable = webBuild({ authority: "a", id: null, label: null });

// @ts-expect-error -- the id is required, so a build cannot name none by leaving it out.
webBuild({ authority: "com.example.notes" });

// @ts-expect-error -- a build id is text.
webBuild({ authority: "com.example.notes", id: 7 });

// A release a custom source names is a release of a target decision as it stands, and it says which build, so a build nobody named cannot be left out.
export const named = webRelease({
  authority: "com.example.notes",
  id: "a91b44e",
});

expectTypeOf(named).toEqualTypeOf<Release>();

export const decision: TargetDecision = { kind: "target", release: named };

// @ts-expect-error -- a release names its build, so the id is required.
webRelease({ authority: "com.example.notes" });

// @ts-expect-error -- a release is an authority's claim, so an id nobody defined cannot be passed as a missing one.
webRelease({ authority: "com.example.notes", id: undefined });

// @ts-expect-error -- the authority is who assigns the ids, so it is required.
webRelease({ id: "a91b44e" });

// @ts-expect-error -- a build id is text.
webRelease({ authority: "com.example.notes", id: 7 });

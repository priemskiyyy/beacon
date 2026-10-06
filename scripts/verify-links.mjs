import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Reads the built site, which is what a visitor gets, and checks that it leads
// somewhere: every internal link, script, style and image resolves to a file of it,
// under the base path the site was built for, and every `#fragment` to an id on that
// page; every page is reached from another; the 404 page is there; and every code
// group in the sources rendered as one. Run `pnpm build:docs` first, with the same
// `DOCS_BASE_PATH` the deployment uses.
//
//   DOCS_BASE_PATH=/beacon/ pnpm build:docs && DOCS_BASE_PATH=/beacon/ pnpm verify:links
const workspace = fileURLToPath(new URL("..", import.meta.url));
const docs = path.join(workspace, "docs");
const dist = path.join(docs, ".vitepress/dist");

const siteUrl = process.env.DOCS_SITE_URL;

const base =
  process.env.DOCS_BASE_PATH ?? (siteUrl ? new URL(siteUrl).pathname : "/");

const problems = [];

const fail = (message) => {
  problems.push(message);
};

if (!existsSync(dist)) {
  console.error("The site is not built: run pnpm build:docs first.");
  process.exit(1);
}

const listFiles = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name);

    return entry.isDirectory() ? listFiles(file) : [file];
  });

const pages = listFiles(dist).filter((file) => file.endsWith(".html"));

const idsCache = new Map();

// The ids of a page, which is what a `#fragment` names.
const idsOf = (file) => {
  if (!idsCache.has(file)) {
    idsCache.set(
      file,
      new Set(
        [...readFileSync(file, "utf8").matchAll(/\bid="([^"]+)"/g)].map(
          (match) => match[1],
        ),
      ),
    );
  }

  return idsCache.get(file);
};

// What a page's file is called for a reader: `getting-started.html` is `/getting-started`.
const urlOf = (file) => {
  const relative = path.relative(dist, file).split(path.sep).join("/");

  if (relative === "index.html") {
    return base;
  }

  return `${base}${relative.replace(/\.html$/, "")}`;
};

const candidatesOf = (pathname) => {
  const target = path.join(dist, pathname);

  return [target, `${target}.html`, path.join(target, "index.html")];
};

const resolveFile = (pathname) =>
  candidatesOf(pathname).find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile(),
  );

const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i;

const inbound = new Map(pages.map((file) => [file, new Set()]));

let checked = 0;

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  const here = urlOf(page);

  for (const [, , raw] of html.matchAll(/\b(href|src)="([^"]*)"/g)) {
    const reference = raw.replaceAll("&amp;", "&");

    // The site's own absolute address is internal; any other scheme is somebody else's.
    const local =
      siteUrl !== undefined && reference.startsWith(siteUrl)
        ? `${base}${reference.slice(siteUrl.length)}`
        : reference;

    if (EXTERNAL.test(local) || local === "") {
      continue;
    }

    const url = new URL(local, `http://site${here}`);

    checked += 1;

    if (!url.pathname.startsWith(base)) {
      fail(
        `${urlOf(page)} links to ${raw}, which is outside the base path ${base}.`,
      );
      continue;
    }

    const pathname = decodeURIComponent(url.pathname.slice(base.length));

    const file =
      pathname === "" ? path.join(dist, "index.html") : resolveFile(pathname);

    if (file === undefined) {
      fail(`${urlOf(page)} links to ${raw}, which the site does not contain.`);
      continue;
    }

    if (file.endsWith(".html") && inbound.has(file) && file !== page) {
      inbound.get(file).add(page);
    }

    const fragment = decodeURIComponent(url.hash.slice(1));

    if (
      fragment !== "" &&
      file.endsWith(".html") &&
      !idsOf(file).has(fragment)
    ) {
      fail(
        `${urlOf(page)} links to ${raw}, and ${urlOf(file)} has no #${fragment}.`,
      );
    }
  }
}

// A page nobody links to is a page nobody finds: the navigation and the sidebar have to reach every one.
for (const [file, from] of inbound) {
  if (
    from.size === 0 &&
    !["index.html", "404.html"].includes(path.basename(file))
  ) {
    fail(`${urlOf(file)} is linked from no other page of the site.`);
  }
}

// A mistyped address lands on the site's own page, which says so and leads home.
const notFound = path.join(dist, "404.html");

if (!existsSync(notFound)) {
  fail(
    "The site has no 404.html, which is what GitHub Pages serves for an unknown address.",
  );
} else {
  const html = readFileSync(notFound, "utf8");

  // The theme draws the page in the browser, from the route it cannot match, so the file is its shell: the 404 title and description it is built from, and the base that its home link is made from.
  if (
    !/<title>404\b/.test(html) ||
    !html.includes('<meta name="description" content="Not Found">')
  ) {
    fail("404.html is not the not-found page of the theme.");
  }

  if (!html.includes(`\\"base\\":\\"${base}\\"`)) {
    fail(
      `404.html does not know the base path ${base}, so its way home is wrong.`,
    );
  }
}

// A code group that did not render is a pile of fences with no tabs.
const markdown = readdirSync(docs, { recursive: true })
  .filter((name) => name.endsWith(".md") && !name.startsWith(".vitepress"))
  .map((name) => path.join(docs, name));

let groups = 0;

for (const file of markdown) {
  const declared = (readFileSync(file, "utf8").match(/^::: code-group/gm) ?? [])
    .length;

  if (declared === 0) {
    continue;
  }

  const relative = path.relative(docs, file).replace(/\.md$/, "");
  const built = resolveFile(relative === "index" ? "index" : relative);

  const rendered =
    built === undefined
      ? 0
      : (readFileSync(built, "utf8").match(/class="vp-code-group/g) ?? [])
          .length;

  groups += declared;

  if (rendered < declared) {
    fail(
      `${relative}.md has ${declared} code groups, and its page renders ${rendered}.`,
    );
  }
}

if (problems.length > 0) {
  for (const problem of problems) {
    console.error(`- ${problem}`);
  }

  console.error(`\n${problems.length} problem(s) in the built site.`);
  process.exit(1);
}

console.log(
  `Verified ${checked} links in ${pages.length} pages under ${base}, the 404 page and ${groups} code groups.`,
);

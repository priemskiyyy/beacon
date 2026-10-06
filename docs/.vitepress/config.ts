import { defineConfig } from "vitepress";

const siteUrl = process.env.DOCS_SITE_URL;

const base =
  process.env.DOCS_BASE_PATH ?? (siteUrl ? new URL(siteUrl).pathname : "/");

const repositoryUrl = "https://github.com/priemskiyyy/beacon";

export default defineConfig({
  base,
  lang: "en-US",
  title: "Beacon",
  description:
    "Release awareness and update coordination for TypeScript applications on the web and in React Native. Evidence with a lifetime, typed commands, and coordinated disruption.",
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: `${base}beacon.svg` }],
    ["meta", { name: "theme-color", content: "#0ea5e9" }],
  ],
  cleanUrls: true,
  lastUpdated: true,
  ...(siteUrl ? { sitemap: { hostname: siteUrl } } : {}),
  themeConfig: {
    logo: "/beacon.svg",
    socialLinks: [{ icon: "github", link: repositoryUrl }],
    editLink: { pattern: `${repositoryUrl}/edit/main/docs/:path` },
    nav: [
      {
        text: "Getting started",
        items: [
          { text: "Web", link: "/getting-started" },
          { text: "React Native", link: "/react-native" },
        ],
      },
      { text: "Guides", link: "/recipes" },
      {
        text: "Adapters",
        items: [
          { text: "HTTP", link: "/http" },
          { text: "Browser", link: "/browser" },
          { text: "Service worker", link: "/service-worker" },
          { text: "Expo", link: "/expo" },
          { text: "Device info", link: "/device-info" },
          { text: "CodePush", link: "/code-push" },
          { text: "App Store", link: "/app-store" },
          { text: "Google Play", link: "/google-play" },
          { text: "Firebase Remote Config", link: "/firebase-remote-config" },
          { text: "Custom adapters", link: "/custom-adapters" },
        ],
      },
      {
        text: "Other frameworks",
        items: [
          { text: "Vue", link: "/vue" },
          { text: "Solid", link: "/solid" },
          { text: "Svelte", link: "/svelte" },
        ],
      },
      { text: "API", link: "/api" },
      {
        text: "0.1.0",
        link: `${repositoryUrl}/blob/main/CHANGELOG.md`,
      },
    ],
    sidebar: [
      {
        text: "Getting started",
        items: [
          { text: "Web", link: "/getting-started" },
          { text: "React Native", link: "/react-native" },
        ],
      },
      {
        text: "Guides",
        items: [
          {
            text: "An update banner",
            link: "/recipes#an-update-banner-that-waits-for-a-saved-form",
          },
          {
            text: "A forced upgrade",
            link: "/react-native#stop-a-build-that-is-too-old",
          },
          { text: "Guarding unsaved input", link: "/disruptions" },
          { text: "The journal", link: "/journal" },
          { text: "Checks and triggers", link: "/triggers" },
          { text: "The React hooks", link: "/react" },
          { text: "Recipes", link: "/recipes" },
          { text: "Testing", link: "/testing" },
          { text: "Devtools", link: "/devtools" },
        ],
      },
      {
        text: "Concepts",
        items: [
          { text: "What Beacon is", link: "/" },
          { text: "The mental model", link: "/mental-model" },
          { text: "Routes", link: "/routes" },
          { text: "Support", link: "/support" },
          { text: "Scopes", link: "/scopes" },
          { text: "Sessions", link: "/sessions" },
        ],
      },
      {
        text: "Adapters",
        items: [
          { text: "HTTP", link: "/http" },
          { text: "Browser", link: "/browser" },
          { text: "Service worker", link: "/service-worker" },
          { text: "Expo", link: "/expo" },
          { text: "Device info", link: "/device-info" },
          { text: "CodePush", link: "/code-push" },
          { text: "App Store", link: "/app-store" },
          { text: "Google Play", link: "/google-play" },
          { text: "Firebase Remote Config", link: "/firebase-remote-config" },
          { text: "Custom adapters", link: "/custom-adapters" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/api" },
          { text: "Commands", link: "/commands" },
          { text: "Troubleshooting", link: "/troubleshooting" },
          { text: "Limits", link: "/limits" },
          { text: "Verification", link: "/verification" },
          { text: "Decisions", link: "/decisions" },
        ],
      },
      {
        text: "Other frameworks",
        items: [
          { text: "Vue", link: "/vue" },
          { text: "Solid", link: "/solid" },
          { text: "Svelte", link: "/svelte" },
        ],
      },
      {
        text: "Internals",
        items: [{ text: "Architecture", link: "/internals/architecture" }],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: { message: "Released under the MIT License." },
  },
});

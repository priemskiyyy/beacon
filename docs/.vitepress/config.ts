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
      { text: "Guide", link: "/getting-started" },
      { text: "Adapters", link: "/http" },
      {
        text: "Frameworks",
        items: [
          { text: "React", link: "/react" },
          { text: "React Native", link: "/react-native" },
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
        text: "Start here",
        items: [
          { text: "What Beacon is", link: "/" },
          { text: "Getting started", link: "/getting-started" },
          { text: "The mental model", link: "/mental-model" },
        ],
      },
      {
        text: "Guides",
        items: [
          { text: "Routes", link: "/routes" },
          { text: "Commands", link: "/commands" },
          { text: "Support", link: "/support" },
          { text: "Disruptions", link: "/disruptions" },
          { text: "Journal", link: "/journal" },
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
          { text: "Google Play", link: "/google-play" },
          { text: "App Store", link: "/app-store" },
          { text: "Firebase Remote Config", link: "/firebase-remote-config" },
          { text: "CodePush", link: "/code-push" },
          { text: "Device info", link: "/device-info" },
          { text: "Triggers", link: "/triggers" },
          { text: "Custom adapters", link: "/custom-adapters" },
        ],
      },
      {
        text: "Build your application",
        items: [
          { text: "React", link: "/react" },
          { text: "React Native", link: "/react-native" },
          { text: "Vue", link: "/vue" },
          { text: "Solid", link: "/solid" },
          { text: "Svelte", link: "/svelte" },
          { text: "Devtools", link: "/devtools" },
          { text: "Recipes", link: "/recipes" },
          { text: "Testing", link: "/testing" },
          { text: "Troubleshooting", link: "/troubleshooting" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "API", link: "/api" },
          { text: "Verification", link: "/verification" },
          { text: "Limits", link: "/limits" },
          { text: "Decisions", link: "/decisions" },
          { text: "Architecture", link: "/internals/architecture" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
    footer: { message: "Released under the MIT License." },
  },
});

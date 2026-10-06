import { existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { configDefaults, defineConfig } from "vitest/config";
import type { TestProjectConfiguration } from "vitest/config";

type ProjectOptions = {
  environment: "node" | "jsdom";
  dedupe: string[];
  include: string[];
  exclude: string[];
};

const PROJECT_OPTIONS: Record<string, Partial<ProjectOptions>> = {
  // A binding must render against the same React instance as the renderer under test.
  react: { environment: "jsdom", dedupe: ["react", "react-dom"] },
};

const project = (
  directory: string,
  name: string,
  options: Partial<ProjectOptions> = PROJECT_OPTIONS[name] ?? {},
) =>
  ({
    extends: true,
    resolve: {
      alias: {
        src: fileURLToPath(
          new URL(`./${directory}/${name}/src`, import.meta.url),
        ),
      },
      dedupe: options.dedupe ?? [],
    },
    test: {
      name,
      include: (options.include ?? ["**/*.test.{ts,tsx}"]).map(
        (pattern) => `${directory}/${name}/src/${pattern}`,
      ),
      exclude: [...configDefaults.exclude, ...(options.exclude ?? [])],
      environment: options.environment ?? "node",
    },
  }) satisfies TestProjectConfiguration;

// Every package is an ordinary project named after its folder, so a new one is
// tested without being listed here.
const discover = (directory: string) => {
  const root = new URL(`./${directory}`, import.meta.url);

  if (!existsSync(root)) {
    return [];
  }

  return readdirSync(root).flatMap((name) => {
    const manifest = new URL(
      `./${directory}/${name}/package.json`,
      import.meta.url,
    );

    if (!existsSync(manifest)) {
      return [];
    }

    return [project(directory, name)];
  });
};

export default defineConfig({
  test: {
    globals: false,
    restoreMocks: true,
    projects: [...discover("packages"), ...discover("packages/adapters")],
  },
});

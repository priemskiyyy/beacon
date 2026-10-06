import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vitest";

// React Native 0.86 builds Hermes V1 at hermes-v250829098.0.17, and that
// compiler gets some syntax wrong. The Babel preset of Expo SDK 57 rewrites
// each of these before Hermes sees them (babel-preset-expo, configs/hermes-v1.js
// and its plugins/fix-hermes-v1-*.js, which name the upstream fixes), and the
// preset of a bare app lowers every async function, so an application usually
// never meets them. A package that ships none of them does not depend on that.
//
// - An async arrow function with a parameter that is not a plain name, such as
//   `async ({ scope }) => {}` or `async (options = {}) => {}`, reads its
//   parameters wrong and resolves `undefined` (facebook/hermes#1761).
// - A class declared inside a `finally` block.
// - `super.x` inside a getter or setter of an object literal.
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");

const PACKAGES = [
  "packages/core",
  "packages/react",
  "packages/adapters/http",
  "packages/adapters/expo",
  "packages/adapters/google-play",
  "packages/adapters/app-store",
  "packages/adapters/firebase-remote-config",
];

// The part of a Babel node and path these checks read.
type Node = {
  type: string;
  async?: boolean;
  kind?: string;
  computed?: boolean;
  params?: Array<{ type: string }>;
  loc: { start: { line: number } };
};

type NodePath = { node: Node; key: string; parentPath: NodePath | null };

const reactNative = createRequire(import.meta.url).resolve(
  "react-native/package.json",
);

const babel = createRequire(reactNative)("@babel/core");

const listBuilt = (folder: string) =>
  readdirSync(path.join(ROOT, folder, "dist")).flatMap((name) => {
    if (!name.endsWith(".js")) {
      return [];
    }

    return [path.join(folder, "dist", name)];
  });

const scan = (file: string) => {
  const found: string[] = [];

  const ast = babel.parseSync(readFileSync(path.join(ROOT, file), "utf8"), {
    babelrc: false,
    configFile: false,
    sourceType: "module",
    filename: file,
  });

  const at = (kind: string, { loc }: Node) =>
    found.push(`${kind} at ${file}:${loc.start.line}`);

  babel.traverse(ast, {
    ArrowFunctionExpression({ node }: NodePath) {
      const plain = (node.params ?? []).every(
        ({ type }) => type === "Identifier",
      );

      if (node.async !== true || plain) {
        return;
      }

      at(
        "an async arrow function with a parameter that is not a plain name",
        node,
      );
    },
    Class({ node, parentPath }: NodePath) {
      let inner: NodePath | null = null;
      let parent = parentPath;

      while (parent !== null) {
        if (/Function|Method|StaticBlock/.test(parent.node.type)) {
          return;
        }

        if (parent.node.type === "TryStatement" && inner?.key === "finalizer") {
          at("a class declared in a finally block", node);

          return;
        }

        inner = parent;
        parent = parent.parentPath;
      }
    },
    Super({ node, parentPath }: NodePath) {
      if (parentPath?.node.type !== "MemberExpression") {
        return;
      }

      let parent: NodePath | null = parentPath;

      while (parent !== null) {
        const { type, kind, computed } = parent.node;

        if (
          /^(ClassMethod|ClassPrivateMethod|FunctionExpression|FunctionDeclaration|StaticBlock|ClassProperty|ClassPrivateProperty)$/.test(
            type,
          )
        ) {
          return;
        }

        if (
          type === "ObjectMethod" &&
          computed !== true &&
          (kind === "get" || kind === "set")
        ) {
          at("super in a getter or setter of an object literal", node);

          return;
        }

        parent = parent.parentPath;
      }
    },
  });

  return found;
};

test.each(PACKAGES)(
  "%s ships no syntax that Hermes V1 compiles wrongly",
  (folder) => {
    expect(listBuilt(folder).flatMap(scan)).toEqual([]);
  },
);

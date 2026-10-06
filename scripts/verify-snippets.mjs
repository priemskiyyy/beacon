import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compileScript, parse as parseSfc } from "vue/compiler-sfc";
import { readWorkspacePackages } from "./readWorkspacePackages.mjs";

// Every ts, tsx, vue and svelte fence a reader could copy compiles against the
// built declarations of the workspace packages, as an installed package would
// provide them. Run `pnpm build` first.
//
// - A fence preceded by `<!-- snippet: fragment -->` is an excerpt and is skipped.
// - A fence whose first line is a file name comment, such as `// src/beacon.ts`
//   or `<!-- src/App.vue -->`, is written under that name, so a later fence of
//   the same page can import it.
// - Fences share one program, except those of a page that names a file, augments
//   a module or holds a svelte fence: `Register` and a named file are global to
//   a program, so such a page gets a program of its own.
// - A page that names the same file again is a guide that changes it: the
//   second fence starts a new program, seeded with the files named so far and
//   with that file replaced, so each step of the page compiles as the reader
//   has it when they get there.
// - A vue fence needs a `<script setup lang="ts">`. The Vue compiler turns it
//   into a typed component, and the expressions of its template are then checked
//   as statements that read the component's bindings the way the template does:
//   `v-if`, `v-else-if` and `v-else` narrow, `v-for` and `v-slot` bind names, and
//   a component tag must be imported. Not checked: the props, events and slots
//   of a component, the attributes of an element and whether a `v-model` can be
//   assigned.
// - A svelte fence is checked by `svelte-check`, as the Svelte package does, and
//   a warning fails it.
// - Names an application would declare and the page does not are in
//   `snippets.ambient.d.ts`. Below its `snippets: readme-only` line are the
//   names the package READMEs use without declaring or importing, and only the
//   READMEs see them, so a page of the documentation cannot lean on them.
const workspace = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(workspace, ".artifacts/snippets");

const ambientText = readFileSync(
  path.join(workspace, "scripts/snippets.ambient.d.ts"),
  "utf8",
);

const READMES_ONLY = "// snippets: readme-only";

const typescript = path.join(workspace, "node_modules/typescript/bin/tsc");

const svelteCheck = path.join(
  workspace,
  "node_modules/svelte-check/bin/svelte-check",
);

const listMarkdown = (directory) =>
  readdirSync(directory, { recursive: true })
    .filter((name) => name.endsWith(".md") && !name.startsWith(".vitepress"))
    .map((name) => path.join(directory, name));

const listReadmes = (directory) => {
  const parent = path.join(workspace, directory);

  if (!existsSync(parent)) {
    return [];
  }

  return readdirSync(parent, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name !== "node_modules")
    .map((entry) => path.join(parent, entry.name, "README.md"))
    .filter((file) => existsSync(file));
};

const pages = [
  path.join(workspace, "README.md"),
  ...listReadmes("packages"),
  ...listReadmes("packages/adapters"),
  ...listReadmes("examples"),
  ...listMarkdown(path.join(workspace, "docs")),
];

// The published names of the workspace packages, each mapped to its built declarations.
const paths = Object.fromEntries([
  ...readWorkspacePackages(workspace).flatMap(({ entries }) =>
    entries.map(({ module, declaration }) => [module, [declaration]]),
  ),
  ["src/*", ["./src/*"]],
]);

if (paths["@priemskiyyy/beacon"] === undefined) {
  console.error(
    "The core is not built: run `pnpm build` first, so the snippets compile against its declarations.",
  );
  process.exit(1);
}

// Solid compiles its own JSX, so a Solid page needs settings of its own.
const compilerOptionsFor = (page) => {
  if (
    /^(packages\/solid\/|docs\/solid\.md$|examples\/solid)/.test(
      path.relative(workspace, page),
    )
  ) {
    return { jsx: "preserve", jsxImportSource: "solid-js" };
  }

  return {};
};

const slug = (text) => text.replaceAll(/[^A-Za-z0-9]+/g, "_");

const isMarkup = (extension) => extension === "vue" || extension === "svelte";

const readFences = (page) => {
  const lines = readFileSync(page, "utf8").split("\n");

  return lines.flatMap((line, index) => {
    const fence = /^```(ts|tsx|vue|svelte)$/.exec(line);

    if (fence === null) {
      return [];
    }

    const marker = lines
      .slice(0, index)
      .findLast((candidate) => candidate.trim() !== "");

    if (marker?.trim() === "<!-- snippet: fragment -->") {
      return [];
    }

    const end = lines.findIndex(
      (candidate, at) => at > index && candidate === "```",
    );

    if (end === -1) {
      throw new Error(
        `${path.relative(workspace, page)}:${index + 1} opens a fence that never closes.`,
      );
    }

    const body = lines.slice(index + 1, end);

    const named = isMarkup(fence[1])
      ? /^<!-- ((?:src\/)?[\w./-]+\.(?:vue|svelte)) -->$/.exec(body[0] ?? "")
      : /^\/\/ ((?:src\/)?[\w./-]+\.tsx?)$/.exec(body[0] ?? "");

    if (named !== null && isMarkup(fence[1]) && !named[1].endsWith(fence[1])) {
      throw new Error(
        `${path.relative(workspace, page)}:${index + 2} names ${named[1]} in a ${fence[1]} fence.`,
      );
    }

    return [
      {
        page,
        line: index + 1,
        extension: fence[1],
        file: named === null ? null : named[1],
        text: body.join("\n"),
      },
    ];
  });
};

const fences = pages.flatMap(readFences);

// Node and prop types of the template syntax tree that the checker reads.
const ELEMENT = 1;
const TEXT = 2;
const COMMENT = 3;
const INTERPOLATION = 5;
const DIRECTIVE = 7;

// Components that need no import.
const VUE_BUILT_INS = new Set([
  "template",
  "slot",
  "component",
  "transition",
  "transition-group",
  "keep-alive",
  "suspense",
  "teleport",
  "Transition",
  "TransitionGroup",
  "KeepAlive",
  "Suspense",
  "Teleport",
]);

// What the statements of a template read: the instance as the template sees
// it, an event, a slot's props and the items `v-for` walks.
const VUE_PRELUDE = `declare const __ctx: InstanceType<typeof __sfc__>;
declare const $event: any;
declare const __any: any;
type __Item<TSource> = TSource extends readonly (infer TElement)[]
  ? [TElement, number, number]
  : TSource extends number
    ? [number, number, number]
    : TSource extends string
      ? [string, number, number]
      : TSource extends Iterable<infer TElement>
        ? [TElement, number, number]
        : [TSource[keyof TSource], keyof TSource, number];
declare function __vFor<TSource>(source: TSource): __Item<TSource>[];`;

const camelize = (text) =>
  text.replaceAll(/-(\w)/g, (_, letter) => letter.toUpperCase());

const findDirective = (element, names) =>
  element.props.find(
    (prop) => prop.type === DIRECTIVE && names.includes(prop.name),
  );

const readExpression = (directive) => {
  if (directive.exp === undefined) {
    throw new Error(`${directive.rawName} needs an expression.`);
  }

  return directive.exp;
};

// Vue calls a handler that is a path or a function, and wraps anything else as statements.
const isHandlerReference = (source) =>
  /^\s*(?:async\s+)?(?:\([^)]*\)|[\w$]+)\s*=>/.test(source) ||
  /^\s*(?:async\s+)?function\b/.test(source) ||
  /^[\w$]+(?:\.[\w$]+|\[[^\]]+\])*$/.test(source.trim());

const emit = (out, text, line) => {
  out.push({ text, line });
};

const emitExpression = (out, expression) => {
  emit(out, `void (${expression.content});`, expression.loc.start.line);
};

const emitDirective = (out, directive) => {
  const { arg, exp, name, loc } = directive;

  // A dynamic argument is an expression of its own.
  if (arg !== undefined && !arg.isStatic) {
    emitExpression(out, arg);
  }

  if (exp === undefined && name === "bind" && arg !== undefined) {
    emit(out, `void (${camelize(arg.content)});`, loc.start.line);

    return;
  }

  if (exp === undefined) {
    return;
  }

  if (name === "on" && arg !== undefined && !isHandlerReference(exp.content)) {
    emit(out, `${exp.content};`, exp.loc.start.line);

    return;
  }

  emitExpression(out, exp);
};

const emitElement = (out, element) => {
  const loop = findDirective(element, ["for"]);
  const slot = findDirective(element, ["slot"]);
  const line = element.loc.start.line;

  emit(out, "{", line);

  if (loop !== undefined) {
    const { source, value, key, index } = loop.forParseResult;

    // The two later aliases are an index or a key, whichever the source has.
    const aliases = [
      value?.content ?? "_v",
      key?.content ?? "_k",
      index?.content ?? "_i",
    ];

    emit(
      out,
      `for (const [${aliases.join(", ")}] of __vFor(${source.content})) {`,
      loop.loc.start.line,
    );
  }

  if (slot?.exp !== undefined) {
    emit(out, `const ${slot.exp.content} = __any;`, slot.exp.loc.start.line);
  }

  for (const prop of element.props) {
    if (
      prop.type === DIRECTIVE &&
      !["if", "else-if", "else", "for", "slot"].includes(prop.name)
    ) {
      emitDirective(out, prop);
    }
  }

  // An imported component is read, so a missing import is an unknown name.
  if (element.tagType === 1 && !VUE_BUILT_INS.has(element.tag)) {
    // Vue resolves `<update-banner>` and `<updateBanner>` to `UpdateBanner`.
    const name = camelize(`-${element.tag}`);

    emit(out, `void (${name});`, line);
  }

  emitNodes(out, element.children);

  if (loop !== undefined) {
    emit(out, "}", line);
  }

  emit(out, "}", line);
};

// The branch that follows a `v-if`, with only text and comments between.
const readBranch = (nodes, from) => {
  const at = nodes.findIndex(
    (node, position) =>
      position >= from && node.type !== TEXT && node.type !== COMMENT,
  );

  if (at === -1) {
    return undefined;
  }

  const node = nodes[at];

  if (node.type !== ELEMENT) {
    return undefined;
  }

  const directive = findDirective(node, ["else-if", "else"]);

  if (directive === undefined) {
    return undefined;
  }

  return { at, node, directive };
};

const emitNodes = (out, nodes) => {
  let at = 0;

  while (at < nodes.length) {
    const node = nodes[at];

    at += 1;

    if (node.type === INTERPOLATION) {
      emitExpression(out, node.content);
      continue;
    }

    if (node.type !== ELEMENT) {
      continue;
    }

    const condition = findDirective(node, ["if"]);

    if (condition === undefined) {
      emitElement(out, node);
      continue;
    }

    const test = readExpression(condition);

    emit(out, `if (${test.content}) {`, test.loc.start.line);
    emitElement(out, node);

    let branch = readBranch(nodes, at);

    while (branch !== undefined) {
      at = branch.at + 1;

      if (branch.directive.name === "else") {
        emit(out, "} else {", branch.node.loc.start.line);
      } else {
        const next = readExpression(branch.directive);

        emit(out, `} else if (${next.content}) {`, next.loc.start.line);
      }

      emitElement(out, branch.node);
      branch = readBranch(nodes, at);
    }

    emit(out, "}", node.loc.start.line);
  }
};

// Each generated line of the script maps to the first line of the fence that reads the same.
const mapScriptLines = (generated, source) => {
  const wanted = source.split("\n").map((line) => line.trim());
  const cursor = { next: 0, last: 1 };

  return generated.map((line) => {
    const text = line.trim();

    if (text === "") {
      return cursor.last;
    }

    let found = wanted.indexOf(text, cursor.next);

    if (found === -1) {
      found = wanted.indexOf(text);
    }

    if (found === -1) {
      return cursor.last;
    }

    cursor.next = found + 1;
    cursor.last = found + 1;

    return cursor.last;
  });
};

// A vue fence as TypeScript: the component the Vue compiler makes of its script, then its template as statements.
const convertVue = (fence) => {
  const { descriptor, errors } = parseSfc(fence.text, {
    filename: fence.file ?? "fragment.vue",
  });

  if (errors.length > 0) {
    throw new Error(
      errors
        .map((error) => `${error.message} (line ${error.loc?.start.line})`)
        .join("; "),
    );
  }

  if (descriptor.scriptSetup?.lang !== "ts") {
    throw new Error('A vue fence needs a `<script setup lang="ts">`.');
  }

  const script = compileScript(descriptor, {
    id: "snippet",
    genDefaultAs: "__sfc__",
    inlineTemplate: false,
  });

  // A binding the script imports is exposed through a getter.
  const returned = /^const __returned__ = \{(.*)\}$/m.exec(script.content);

  if (returned === null) {
    throw new Error("The compiled script exposes no bindings.");
  }

  const props = Object.entries(script.bindings ?? {}).flatMap(
    ([name, type]) => {
      if (type !== "props") {
        return [];
      }

      return [name];
    },
  );

  const names = new Set(
    [
      ...returned[1]
        .split(",")
        .map((entry) => entry.trim().replace(/^get\s+([\w$]+)\(\).*$/, "$1")),
      ...props,
    ].filter((name) => name !== ""),
  );

  const scriptLines =
    `${script.content.trimEnd()}\nexport default __sfc__;`.split("\n");

  const statements = [];

  if (descriptor.template?.ast !== undefined) {
    emitNodes(statements, descriptor.template.ast.children);
  }

  const lines = [
    ...scriptLines,
    ...VUE_PRELUDE.split("\n"),
    "{",
    // `let`, since a handler may assign to a ref; a never assigned `let` narrows like a `const`.
    `let { ${[...names].join(", ")} } = __ctx;`,
    "const { $attrs, $slots, $emit, $props, $refs } = __ctx;",
  ];

  const lineMap = [
    ...mapScriptLines(scriptLines, fence.text),
    ...VUE_PRELUDE.split("\n").map(() => 1),
    1,
    1,
    1,
  ];

  for (const { text, line } of statements) {
    text.split("\n").forEach((part, offset) => {
      lines.push(part);
      lineMap.push(line + offset);
    });
  }

  lines.push("}");
  lineMap.push(lineMap.at(-1));

  return { code: `${lines.join("\n")}\n`, lineMap };
};

// A page with a named file, an augmentation or a svelte fence runs alone; the rest share one program.
const isolated = new Set(
  fences
    .filter(
      (fence) =>
        fence.file !== null ||
        fence.extension === "svelte" ||
        /\bdeclare module\b/.test(fence.text) ||
        Object.keys(compilerOptionsFor(fence.page)).length > 0,
    )
    .map((fence) => fence.page),
);

rmSync(output, { recursive: true, force: true });
mkdirSync(output, { recursive: true });

writeFileSync(
  path.join(output, "ambient.docs.d.ts"),
  ambientText.slice(0, ambientText.indexOf(READMES_ONLY)),
);
writeFileSync(path.join(output, "ambient.readme.d.ts"), ambientText);

const isReadme = (page) => path.basename(page) === "README.md";

const programs = new Map();
const problems = [];

// A page that writes a file again shows the next step of it: that version is checked in a program of its own, with the files written before it, so every version of a file compiles with the files of its moment.
const steps = new Map();

const nameProgram = (fence) => {
  if (!isolated.has(fence.page)) {
    return isReadme(fence.page) ? "readmes" : "docs";
  }

  const page = slug(path.relative(workspace, fence.page));
  const { number } = steps.get(fence.page) ?? { number: 0 };

  return number === 0 ? page : `${page}__${number}`;
};

const addFence = (name, fence) => {
  const folder = path.join(output, name);

  const file = path.join(
    folder,
    fence.file ??
      `${slug(path.relative(workspace, fence.page))}_${fence.line}.${fence.extension}`,
  );

  mkdirSync(path.dirname(file), { recursive: true });

  const program = programs.get(name) ?? {
    folder,
    options: compilerOptionsFor(fence.page),
    ambient: path.join(
      output,
      isReadme(fence.page) ? "ambient.readme.d.ts" : "ambient.docs.d.ts",
    ),
    files: [],
  };

  programs.set(name, program);

  if (fence.extension === "svelte") {
    writeFileSync(file, `${fence.text}\n`);
    program.files.push({ file, fence });

    return;
  }

  if (fence.extension === "vue") {
    // The import `./Name.vue` resolves to `Name.vue.ts`, so a page's fences can import each other.
    try {
      const { code, lineMap } = convertVue(fence);

      writeFileSync(`${file}.ts`, code);
      program.files.push({ file: `${file}.ts`, fence, lineMap });
    } catch (error) {
      problems.push(
        `${path.relative(workspace, fence.page)}:${fence.line}: ${error.message}`,
      );
    }

    return;
  }

  // A file with no import or export is a script, and its names would be shared.
  writeFileSync(file, `${fence.text}\nexport {};\n`);
  program.files.push({ file, fence });
};

for (const fence of fences) {
  if (isolated.has(fence.page) && fence.file !== null) {
    const step = steps.get(fence.page) ?? { number: 0, named: new Map() };

    steps.set(fence.page, step);

    if (step.named.has(fence.file)) {
      step.named.delete(fence.file);
      step.number += 1;

      for (const earlier of step.named.values()) {
        addFence(nameProgram(fence), earlier);
      }
    }

    step.named.set(fence.file, fence);
  }

  addFence(nameProgram(fence), fence);
}

// An augmentation alone does not load the module it augments, so the program imports it.
const readAugmented = (files) => [
  ...new Set(
    files.flatMap(({ fence }) =>
      [...fence.text.matchAll(/\bdeclare module "([^"]+)"/g)].map(
        (match) => match[1],
      ),
    ),
  ),
];

for (const program of programs.values()) {
  const { folder, options, ambient, files } = program;
  const augmented = path.join(folder, "augmented.ts");

  writeFileSync(
    augmented,
    `${readAugmented(files)
      .map((name) => `import type {} from "${name}";`)
      .join("\n")}\nexport {};\n`,
  );

  program.svelte = files.some(({ fence }) => fence.extension === "svelte");

  writeFileSync(
    path.join(folder, "tsconfig.json"),
    `${JSON.stringify(
      {
        extends: "../../../tsconfig.json",
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
          // The runes of a svelte file are declared by the svelte types.
          types: program.svelte ? ["node", "svelte"] : ["node"],
          baseUrl: ".",
          paths,
          ...options,
        },
        // Wildcards skip dot directories such as .artifacts, so every file is named.
        include: [],
        files: [...files.map(({ file }) => file), augmented, ambient],
      },
      null,
      2,
    )}\n`,
  );
}

const run = (command, args, program) =>
  new Promise((resolve) => {
    const child = spawn(command, args, { cwd: workspace });

    let stdout = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stdout += chunk;
    });
    child.on("close", (status) => resolve({ program, status, stdout }));
  });

// A program with a svelte file goes to svelte-check, which checks its ts files too.
const compile = (program) => {
  if (program.svelte) {
    return run(
      process.execPath,
      [
        svelteCheck,
        "--workspace",
        program.folder,
        "--tsconfig",
        "./tsconfig.json",
        "--fail-on-warnings",
        "--output",
        "machine",
      ],
      program,
    );
  }

  return run(
    process.execPath,
    [typescript, "-p", program.folder, "--pretty", "false"],
    program,
  );
};

const results = await Promise.all([...programs.values()].map(compile));

// The two shapes a checker reports: `svelte-check --output machine` and tsc.
const readDiagnostic = (line, program) => {
  const machine = /^\d+ (ERROR|WARNING) "(.+?)" (\d+):\d+ "(.*)"$/.exec(line);

  if (machine !== null) {
    const [, kind, file, at, message] = machine;
    // The message is JSON text and may run over lines: keep the first.
    const [first] = JSON.parse(`"${message}"`).split("\n");

    return {
      file: path.resolve(program.folder, file),
      at: Number(at),
      message: `${kind === "WARNING" ? "warning: " : ""}${first}`,
    };
  }

  const compiler = /^(.+?)\((\d+),\d+\): (.*)$/.exec(line);

  if (compiler !== null) {
    return {
      file: path.resolve(workspace, compiler[1]),
      at: Number(compiler[2]),
      message: compiler[3],
    };
  }

  return undefined;
};

// Map each error back to the page and line its fence came from.
const locate = (line, program) => {
  const diagnostic = readDiagnostic(line, program);

  if (diagnostic === undefined) {
    return line;
  }

  const found = program.files.find(({ file }) => file === diagnostic.file);

  if (found === undefined) {
    return line;
  }

  const { page, line: fenceLine } = found.fence;
  const at = found.lineMap?.[diagnostic.at - 1] ?? diagnostic.at;

  return `${path.relative(workspace, page)}:${fenceLine + at}: ${diagnostic.message}`;
};

const failed = results.filter(({ status }) => status !== 0);

for (const problem of problems) {
  console.error(problem);
}

for (const { program, stdout } of failed) {
  for (const line of stdout.split("\n")) {
    if (line.trim() !== "" && !/^\d+ (START|COMPLETED) /.test(line)) {
      console.error(locate(line, program));
    }
  }
}

if (failed.length > 0 || problems.length > 0) {
  process.exit(1);
}

console.log(
  `Compiled ${fences.length} snippets from ${pages.length} pages in ${programs.size} programs.`,
);

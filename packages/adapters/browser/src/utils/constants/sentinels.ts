/** What a missing define becomes where the code writes the constant into text: `String(undefined)`, or a template literal around it. Neither is a build. */
export const NOT_INJECTED_TEXTS = new Set(["undefined", "null"]);

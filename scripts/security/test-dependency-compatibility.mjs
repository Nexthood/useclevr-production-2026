import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const payloadMcp = require.resolve("@payloadcms/plugin-mcp");
const { toolSchemas } = await import(
  pathToFileURL(join(dirname(payloadMcp), "mcp/tools/schemas.js"))
);
const richtextRequire = createRequire(require.resolve("@payloadcms/richtext-lexical"));
const headlessRequire = createRequire(richtextRequire.resolve("@lexical/headless"));
const { createHeadlessEditor } = richtextRequire("@lexical/headless");
const { Window } = await import(pathToFileURL(headlessRequire.resolve("happy-dom")));
const { $generateNodesFromDOM } = richtextRequire("@lexical/html");
const { $getRoot } = headlessRequire("lexical");

test("Payload MCP record parameters accept populated records with patched Zod", () => {
  let checked = 0;
  for (const tool of Object.values(toolSchemas)) {
    for (const name of ["inputSchema", "jobData", "configUpdate", "outputSchema"]) {
      const field = tool.parameters?.shape?.[name];
      if (!field) continue;
      assert.equal(field.safeParse({ compatibilityProbe: "value" }).success, true, name);
      checked++;
    }
  }
  assert.ok(checked >= 4, "exercise Payload's record parameters, including job schemas");
});

test("Payload's Lexical headless editor imports HTML with patched happy-dom", async () => {
  const window = new Window();
  try {
    const document = new window.DOMParser().parseFromString(
      "<p>Release compatibility</p>",
      "text/html",
    );
    const editor = createHeadlessEditor({
      namespace: "release-dependency-compatibility",
      nodes: [],
      onError(error) {
        throw error;
      },
    });
    editor.update(
      () => {
        $getRoot().append(...$generateNodesFromDOM(editor, document));
      },
      { discrete: true },
    );
    editor.getEditorState().read(() => {
      assert.equal($getRoot().getTextContent(), "Release compatibility");
    });
  } finally {
    await window.happyDOM.close();
  }
});

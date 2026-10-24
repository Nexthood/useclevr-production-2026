import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { test } from "node:test";

const pluginUrl = import.meta.resolve("@payloadcms/plugin-mcp");
const pluginRequire = createRequire(pluginUrl);
const lexicalRequire = createRequire(import.meta.resolve("@payloadcms/richtext-lexical"));
const headlessRequire = createRequire(lexicalRequire.resolve("@lexical/headless"));

test("patched Zod preserves Payload MCP discovery, validation, and invocation", async () => {
  const { z } = await import(pluginRequire.resolve("zod"));
  const sdkRequire = createRequire(
    pluginRequire.resolve("@modelcontextprotocol/sdk/server/mcp.js"),
  );
  assert.equal(pluginRequire("zod/package.json").version, sdkRequire("zod/package.json").version);
  assert.match(pluginRequire("zod/package.json").version, /^4\./);
  const { McpServer } = await import(
    pluginRequire.resolve("@modelcontextprotocol/sdk/server/mcp.js")
  );
  const { Client } = await import(
    pluginRequire.resolve("@modelcontextprotocol/sdk/client/index.js")
  );
  const { InMemoryTransport } = await import(
    pluginRequire.resolve("@modelcontextprotocol/sdk/inMemory.js")
  );
  const { findResourceTool } = await import(new URL("./mcp/tools/resource/find.js", pluginUrl));
  const { createResourceTool } = await import(new URL("./mcp/tools/resource/create.js", pluginUrl));
  const calls = [];
  const req = {
    payload: {
      config: { collections: [{ slug: "faqs", fields: [], flattenedFields: [] }] },
      logger: { info() {}, warn() {}, error() {} },
      find: async (args) => {
        calls.push(args);
        return {
          docs: [{ id: "fixture", title: "Synthetic FAQ" }],
          totalDocs: 1,
          page: 1,
          totalPages: 1,
        };
      },
      create: async (args) => {
        calls.push(args);
        return { id: "fixture", ...args.data };
      },
    },
  };
  const user = { id: "synthetic-operator" };
  const collections = { faqs: { enabled: { find: true, create: true } } };
  const server = new McpServer({ name: "compatibility-fixture", version: "1.0.0" });
  findResourceTool(server, req, user, false, "faqs", collections);
  createResourceTool(server, req, user, false, "faqs", collections, {
    type: "object",
    properties: { title: { type: "string" } },
    required: ["title"],
  });
  server.registerTool(
    "lookupDataset",
    { inputSchema: { datasetId: z.string().min(1) } },
    async ({ datasetId }) => ({ content: [{ type: "text", text: datasetId }] }),
  );
  const client = new Client({ name: "compatibility-client", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    const find = tools.find((tool) => tool.name === "findFaqs");
    assert.equal(find.inputSchema.properties.limit.type, "integer");
    const create = tools.find((tool) => tool.name === "createFaqs");
    assert.equal(create.inputSchema.properties.title.type, "string");
    assert.ok(create.inputSchema.required.includes("title"));
    const lookup = tools.find((tool) => tool.name === "lookupDataset");
    assert.deepEqual(lookup.inputSchema.required, ["datasetId"]);
    assert.equal(
      (await client.callTool({ name: "lookupDataset", arguments: { datasetId: "" } })).isError,
      true,
    );
    assert.equal(
      (await client.callTool({ name: "lookupDataset", arguments: { datasetId: "fixture" } }))
        .content[0].text,
      "fixture",
    );
    assert.equal(
      (await client.callTool({ name: "findFaqs", arguments: { limit: 2 } })).isError,
      undefined,
    );
    assert.equal(calls.length, 1);
    assert.equal(calls[0].limit, 2);
    assert.equal(calls[0].overrideAccess, false);
    assert.equal(calls[0].user, user);
    assert.equal((await client.callTool({ name: "createFaqs", arguments: {} })).isError, true);
    const created = await client.callTool({
      name: "createFaqs",
      arguments: { title: "Synthetic FAQ" },
    });
    assert.match(created.content[0].text, /created successfully/);
    assert.equal(calls.length, 2);
    assert.deepEqual(calls[1].data, { title: "Synthetic FAQ" });
    assert.equal(calls[1].overrideAccess, false);
  } finally {
    await client.close();
    await server.close();
  }
});

test("patched Happy DOM supports Payload Lexical HTML import and persistence", async () => {
  const { createHeadlessEditor } = lexicalRequire("@lexical/headless");
  const { $generateNodesFromDOM, $generateHtmlFromNodes } = lexicalRequire("@lexical/html");
  const { $getRoot } = lexicalRequire("lexical");
  const { withDOM } = lexicalRequire("@lexical/headless/dom");
  const version = headlessRequire("happy-dom/package.json").version.split(".").map(Number);
  assert.ok(version[0] > 21 || (version[0] === 21 && (version[1] > 0 || version[2] >= 4)));
  await withDOM(() => {
    document.body.innerHTML = "<p>Passport <strong>owner</strong> &amp; scope</p>";
    const editor = createHeadlessEditor({
      namespace: "security-compatibility",
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
    const saved = editor.getEditorState().toJSON();
    editor.setEditorState(editor.parseEditorState(JSON.stringify(saved)));
    editor.getEditorState().read(() => {
      assert.equal($getRoot().getTextContent(), "Passport owner & scope");
      const html = $generateHtmlFromNodes(editor);
      assert.match(html, /<b>|<strong/);
      assert.match(html, /owner/);
    });
  });
});

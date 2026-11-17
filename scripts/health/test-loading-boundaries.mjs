import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import ts from "typescript";

// Run with --conditions=react-server to exercise the real Flight serializer.
const require = createRequire(import.meta.url);
const {
  registerClientReference,
  renderToReadableStream,
} = require("next/dist/compiled/react-server-dom-webpack/server.node");
const root = new URL("../../", import.meta.url);
const loadingPath = "src/components/ui/loading-screen.tsx";
const manifest = {
  [`${loadingPath}#LoadingScreen`]: {
    id: loadingPath,
    name: "LoadingScreen",
    chunks: [],
    async: false,
  },
};
const clientLoading = registerClientReference(() => {}, loadingPath, "LoadingScreen");
// Lucide icons are forwardRef objects with an internal render function.
const icon = React.forwardRef(function FixtureIcon(props, ref) {
  return React.createElement("svg", { ...props, ref });
});

function compile(file, imports = {}) {
  const source = readFileSync(new URL(file, root), "utf8");
  const js = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
  }).outputText;
  const exports = {};
  const load = (name) => {
    assert.ok(Object.hasOwn(imports, name), `Unexpected dependency: ${name}`);
    return imports[name];
  };
  new Function("React", "exports", "require", js)(React, exports, load);
  return exports;
}

async function serialize(element) {
  const errors = [];
  const stream = renderToReadableStream(element, manifest, {
    onError(error) {
      errors.push(error.message);
      return "loading-regression";
    },
  });
  let wire = "";
  for await (const chunk of stream) wire += Buffer.from(chunk).toString();
  return { errors, wire };
}

// Positive control: a server-to-client icon prop must reproduce the reported error.
const previous = await serialize(
  React.createElement(clientLoading, {
    icon,
    text: "Loading datasets...",
  }),
);
assert.ok(
  previous.errors.some((message) =>
    message.includes("Functions cannot be passed directly to Client Components"),
  ),
);

const loadingSource = readFileSync(new URL(loadingPath, root), "utf8");
const clientDirective = ts
  .createSourceFile(loadingPath, loadingSource, ts.ScriptTarget.Latest, true)
  .statements.some(
    (statement) =>
      ts.isExpressionStatement(statement) &&
      ts.isStringLiteral(statement.expression) &&
      statement.expression.text === "use client",
  );
const LoadingScreen = clientDirective ? clientLoading : compile(loadingPath).LoadingScreen;
for (const route of ["accountancy", "admin", "assistant", "datasets", "settings", "tickets"]) {
  const routePath = `src/app/(auth)/app/${route}/loading.tsx`;
  const routeSource = readFileSync(new URL(routePath, root), "utf8");
  const routeStatements = ts.createSourceFile(routePath, routeSource, ts.ScriptTarget.Latest, true).statements;
  assert.ok(!routeStatements.some((statement) =>
    ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression) &&
    statement.expression.text === "use client"
  ), `${route} loading must remain a server component`);
  const icons = new Proxy({}, { get: () => icon });
  const page = compile(routePath, {
    "lucide-react": icons,
    "@/components/ui/loading-screen": { LoadingScreen },
  });
  const result = await serialize(React.createElement(page.default));
  assert.deepEqual(result.errors, [], `${route} loading must serialize successfully`);
  assert.ok(result.wire.includes("Loading"), `${route} retains its loading text`);
  assert.ok(result.wire.includes("animate-pulse"), `${route} retains its animated icon`);
  console.log(`PASS ${route} server loading boundary`);
}
console.log("PASS reported serialization error reproduced by positive control");

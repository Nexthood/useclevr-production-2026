import assert from "node:assert/strict";
import { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function main() {
  // No app database configuration or credentials are read by these boundary tests.
  mock.module("@/lib/db", { namedExports: { getDb: () => null } });
  mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
  let signedIn = false;
  mock.module("@/lib/auth/require-session", {
    namedExports: {
      requireSession: async () =>
        signedIn
          ? { success: true, userId: "fixture-owner", session: { user: { role: "user" } } }
          : { success: false, error: Response.json({ error: "Unauthorized" }, { status: 401 }) },
    },
  });
  const service = await import("../../src/lib/ai-governance/agent-passport-service");
  const collection = await import("../../src/app/api/ai-governance/passports/route");
  const detail = await import("../../src/app/api/ai-governance/passports/[id]/route");
  const { AgentPassportEditor, AgentPassportTraces } =
    await import("../../src/components/ai-governance/agent-passport-editor");
  let passed = 0;
  const check = (label: string) => {
    passed++;
    console.log("PASS " + label);
  };
  const valid = {
    ownerName: "Fixture Owner",
    purpose: "Explain owned business datasets",
    declaredScope: "Owned datasets only",
  };
  for (const bad of [
    null,
    {},
    { ...valid, ownerName: " " },
    { ...valid, purpose: "x".repeat(2001) },
    { ...valid, declaredScope: "x".repeat(4001) },
    { ...valid, riskClass: "certified" },
    { ...valid, lifecycle: "blocked" },
    { ...valid, userId: "another-user" },
    { ...valid, agentKey: "arbitrary-agent" },
    { ...valid, id: "forged" },
  ]) {
    await assert.rejects(
      service.createAgentPassport("fixture-owner", bad),
      (e: unknown) => e instanceof service.PassportError && e.status === 400,
    );
  }
  for (const bad of [
    {},
    { userId: "other" },
    { id: "new" },
    { agentKey: "other" },
    { createdAt: "today" },
  ]) {
    await assert.rejects(
      service.updateAgentPassport("fixture-owner", "id", bad),
      (e: unknown) => e instanceof service.PassportError && e.status === 400,
    );
  }
  check("validate bounded fields, enums, immutable identity, and server-owned tenancy");
  assert.equal(await service.resolveTracePassport("fixture-owner"), null);
  assert.equal(
    await service.resolveTracePassport("fixture-owner", service.CLEVR_ANALYST_KEY),
    null,
  );
  assert.equal((await service.getGovernancePassports({ id: "fixture-owner" })).available, false);
  await assert.rejects(
    service.createAgentPassport("fixture-owner", valid),
    (e: unknown) => e instanceof service.PassportError && e.status === 503,
  );
  check("database unavailability has explicit metadata fallback");
  const url = "https://app.example.test/api/ai-governance/passports";
  const context = { params: Promise.resolve({ id: "fixture-passport" }) };
  assert.equal((await collection.GET()).status, 401);
  assert.equal((await collection.POST(new Request(url, { method: "POST" }))).status, 401);
  assert.equal((await detail.GET(new Request(url), context)).status, 401);
  assert.equal((await detail.PATCH(new Request(url, { method: "PATCH" }), context)).status, 401);
  check("all four operations reject anonymous requests before database access");
  signedIn = true;
  const crossOriginHeaders: Record<string, string>[] = [
    { origin: "https://evil.example.test" },
    { "sec-fetch-site": "cross-site" },
  ];
  for (const headers of crossOriginHeaders) {
    assert.equal(
      (await collection.POST(new Request(url, { method: "POST", headers }))).status,
      403,
    );
    assert.equal(
      (await detail.PATCH(new Request(url, { method: "PATCH", headers }), context)).status,
      403,
    );
  }
  assert.equal(
    (await collection.POST(new Request(url, { method: "POST", body: "not-json" }))).status,
    400,
  );
  check("mutations reject cross-origin requests and malformed JSON");
  const html = renderToStaticMarkup(
    createElement(AgentPassportEditor, { passport: null, notice: service.PASSPORT_NOTICE }),
  );
  for (const label of [
    "Your name as human owner",
    "Purpose",
    "Declared scope",
    "Owner-declared risk",
    "Lifecycle (descriptive)",
    "Create passport",
    "security certification",
    "runtime restrictions",
  ])
    assert.ok(html.includes(label), label);
  assert.equal((html.match(/<label /g) || []).length, 5);
  assert.ok(html.includes('maxLength="4000"'));
  assert.ok(html.includes('value="draft"'));
  assert.ok(!html.includes("dangerouslySetInnerHTML"));
  const traceHtml = renderToStaticMarkup(
    createElement(AgentPassportTraces, { passportId: "fixture-passport" }),
  );
  assert.ok(traceHtml.includes("View linked traces"));
  assert.ok(traceHtml.includes('type="button"'));
  check("render accessible setup controls, descriptive notice, and on-demand trace viewing");
  console.log("Agent passport boundary tests passed (" + passed + " groups).");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

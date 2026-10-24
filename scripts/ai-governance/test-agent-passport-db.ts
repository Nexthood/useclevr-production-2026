import assert from "node:assert/strict";
import { readFileSync, realpathSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { mock } from "node:test";
import { spawnSync } from "node:child_process";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

async function main() {
  // Verify runner ownership before opening any database client or importing app code.
  const directory = process.env.PASSPORT_TEST_RUN_DIRECTORY;
  assert.ok(directory, "Use pnpm test:agent-passport; direct database execution is forbidden");
  assert.equal(path.dirname(directory), realpathSync(os.tmpdir()));
  assert.match(path.basename(directory), /^useclevr-passport-[A-Za-z0-9]+$/);
  for (const target of [directory, path.join(directory, "socket")]) {
    assert.equal(realpathSync(target), target);
    assert.equal(statSync(target).uid, process.getuid?.());
    assert.equal(statSync(target).mode & 0o777, 0o700);
  }
  assert.equal(
    readFileSync(path.join(directory, "runner-owned"), "utf8"),
    "UseClevr disposable Agent Passport tests\n",
  );
  const expected = new URL("postgresql://useclevr_test@localhost/useclevr_agent_passport_test");
  expected.searchParams.set("host", path.join(directory, "socket"));
  assert.equal(process.env.DATABASE_URL, expected.toString());
  assert.equal(process.env.DIRECT_URL, expected.toString());
  assert.equal(process.env.NODE_ENV, "test");
  assert.equal(process.env.NEON_USE_SERVERLESS, "false");
  assert.equal(process.env.NEON_USE_WS_POOL, "false");

  const pool = new Pool({ connectionString: expected.toString() });
  const db = drizzle(pool);
  mock.module("@/lib/db", { namedExports: { getDb: () => db } });
  let actor = { id: "owner-a", role: "user" };
  mock.module("@/lib/auth/require-session", {
    namedExports: {
      requireSession: async () => ({
        success: true,
        userId: actor.id,
        session: { user: { role: actor.role } },
      }),
    },
  });
  const service = await import("../../src/lib/ai-governance/agent-passport-service");
  const { createTrace } = await import("../../src/lib/ai/ai-trace");
  const collection = await import("../../src/app/api/ai-governance/passports/route");
  const detail = await import("../../src/app/api/ai-governance/passports/[id]/route");
  let passed = 0;
  const check = (label: string) => {
    passed++;
    console.log("PASS " + label);
  };
  const fields = {
    ownerName: "Fixture Owner",
    purpose: "Explain owned datasets",
    declaredScope: "Owned datasets only",
  };
  process.env.AUTH_URL = "https://app.example.test";
  const url = "http://0.0.0.0:8080/api/ai-governance/passports";
  const request = (method: string, body: unknown) =>
    new Request(url, {
      method,
      headers: {
        origin: "https://app.example.test",
        "sec-fetch-site": "same-origin",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
  const context = (id: string) => ({ params: Promise.resolve({ id }) });

  try {
    assert.equal(
      (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rowCount,
      0,
    );
    // Minimal prerequisites; the passport schema itself comes from the real migration.
    await pool.query(`CREATE TABLE "User" (id text PRIMARY KEY);
    INSERT INTO "User" VALUES ('owner-a'), ('owner-b');
    CREATE TABLE "AiInteractionTrace" (
      id text PRIMARY KEY, "userId" text NOT NULL REFERENCES "User"(id) ON DELETE CASCADE,
      "datasetId" text, prompt text NOT NULL, response text NOT NULL,
      "providerName" text NOT NULL, "modelName" text NOT NULL, "promptVersion" text NOT NULL,
      "latencyMs" integer, "tokenCount" integer, "estimatedCostUsd" double precision, error text,
      feedback text, "feedbackText" text, "userAnonymized" boolean NOT NULL DEFAULT false,
      "createdAt" timestamp NOT NULL DEFAULT now());`);
    const migration = readFileSync(
      new URL("../../src/lib/db/migrations/0037_agent_trust_passport.sql", import.meta.url),
      "utf8",
    );
    const inspectSchema = () =>
      spawnSync(process.execPath, ["scripts/ai-governance/check-agent-passport-schema.mjs"], {
        env: process.env,
        encoding: "utf8",
        timeout: 15000,
      });
    const absent = inspectSchema();
    assert.equal(absent.status, 1, absent.stderr);
    assert.equal(JSON.parse(absent.stdout).schemaObjectsPresent, false);
    await pool.query(migration);
    await pool.query(migration);
    const applied = inspectSchema();
    assert.equal(applied.status, 0, applied.stderr);
    assert.deepEqual(JSON.parse(applied.stdout), {
      migration: "0037",
      schemaObjectsPresent: true,
      missing: [],
    });
    check("migration applies idempotently to an empty disposable schema");

    const traceInput = {
      userId: actor.id,
      prompt: "Synthetic question",
      response: "Synthetic answer",
      providerName: "Fixture",
      modelName: "fixture-model",
      agentKey: service.CLEVR_ANALYST_KEY,
    };
    const historical = await createTrace(traceInput);
    assert.ok(historical);
    assert.equal(historical.agentPassportId, null);
    const response = await collection.POST(request("POST", fields));
    assert.equal(response.status, 201);
    const { passport } = await response.json();
    assert.equal(passport.userId, actor.id);
    assert.equal(passport.agentKey, service.CLEVR_ANALYST_KEY);
    assert.equal(passport.riskClass, "unclassified");
    assert.equal(passport.lifecycle, "draft");
    assert.equal((await collection.POST(request("POST", fields))).status, 409);
    check("authenticated creation sets immutable owner identity and rejects duplicate passports");

    for (const lifecycle of ["draft", "active", "retired"]) {
      const updated = await detail.PATCH(
        request("PATCH", { lifecycle, riskClass: "high" }),
        context(passport.id),
      );
      assert.equal(updated.status, 200);
      assert.equal((await updated.json()).passport.id, passport.id);
      const trace = await createTrace({ ...traceInput, modelName: lifecycle });
      assert.equal(trace?.agentPassportId, passport.id);
    }
    const noAgent = await createTrace({ ...traceInput, agentKey: undefined });
    const renamed = await service.updateAgentPassport(actor.id, passport.id, {
      ownerName: "Updated Fixture Owner",
    });
    assert.equal(renamed.ownerName, "Updated Fixture Owner");
    assert.equal(renamed.riskClass, "high");
    assert.equal(renamed.lifecycle, "retired");
    check("partial edits retain omitted risk and lifecycle values");
    assert.equal(noAgent?.agentPassportId, null);
    const countBeforeGhost = (await pool.query('SELECT count(*) FROM "AiInteractionTrace"')).rows[0]
      .count;
    assert.equal(await createTrace({ ...traceInput, ghostMode: true }), null);
    assert.equal(
      (await pool.query('SELECT count(*) FROM "AiInteractionTrace"')).rows[0].count,
      countBeforeGhost,
    );
    assert.equal(
      (
        await pool.query('SELECT "agentPassportId" FROM "AiInteractionTrace" WHERE id=$1', [
          historical.id,
        ])
      ).rows[0].agentPassportId,
      null,
    );
    check(
      "provider changes and descriptive lifecycle retain identity; historical and Eclipse traces stay unassigned",
    );

    actor = { id: "owner-b", role: "user" };
    assert.deepEqual((await (await collection.GET()).json()).passports, []);
    assert.equal((await detail.GET(new Request(url), context(passport.id))).status, 404);
    assert.equal(
      (await detail.PATCH(request("PATCH", { ownerName: "Other Owner" }), context(passport.id)))
        .status,
      404,
    );
    assert.equal(await service.resolveTracePassport(actor.id, service.CLEVR_ANALYST_KEY), null);
    const otherPassport = await service.createAgentPassport(actor.id, fields);
    assert.notEqual(otherPassport.id, passport.id);
    // Even a mismatched database reference cannot expose another owner's traces.
    await createTrace({ ...traceInput, userId: actor.id });
    await pool.query('UPDATE "AiInteractionTrace" SET "agentPassportId"=$1 WHERE "userId"=$2', [
      passport.id,
      actor.id,
    ]);
    check("owners cannot read, edit, or attribute another account's passport");

    actor = { id: "owner-a", role: "superadmin" };
    assert.equal((await (await collection.GET()).json()).passports.length, 2);
    assert.equal((await detail.GET(new Request(url), context(otherPassport.id))).status, 200);
    assert.equal(
      (await detail.PATCH(request("PATCH", { lifecycle: "active" }), context(otherPassport.id)))
        .status,
      404,
    );
    for (let index = 0; index < 23; index++) await createTrace(traceInput);
    const first = await service.listAgentPassportTraces(actor, passport.id);
    const second = await service.listAgentPassportTraces(actor, passport.id, 20);
    assert.equal(first.total, 26);
    assert.equal(first.traces.length, 20);
    assert.equal(second.traces.length, 6);
    assert.equal(new Set([...first.traces, ...second.traces].map((row) => row.id)).size, 26);
    assert.ok(first.traces.every((row) => !("prompt" in row) && !("response" in row)));
    check(
      "superadmin inspection remains read only across owners; trace pagination excludes cross-owner content",
    );

    await assert.rejects(
      pool.query('UPDATE "AiAgentPassport" SET "riskClass"=$1 WHERE id=$2', [
        "certified",
        passport.id,
      ]),
    );
    await assert.rejects(
      pool.query('UPDATE "AiAgentPassport" SET lifecycle=$1 WHERE id=$2', ["blocked", passport.id]),
    );
    await assert.rejects(
      pool.query('UPDATE "AiAgentPassport" SET purpose=$1 WHERE id=$2', [" ", passport.id]),
    );
    await pool.query('DELETE FROM "User" WHERE id=$1', ["owner-a"]);
    assert.equal(
      (await pool.query('SELECT id FROM "AiAgentPassport" WHERE id=$1', [passport.id])).rowCount,
      0,
    );
    assert.equal(
      (
        await pool.query('SELECT "agentPassportId" FROM "AiInteractionTrace" WHERE "userId"=$1', [
          "owner-b",
        ])
      ).rows[0].agentPassportId,
      null,
    );
    check(
      "database constraints enforce metadata values, ownership cascade, and nullable trace references",
    );
    console.log(`Agent passport database tests passed (${passed} groups).`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

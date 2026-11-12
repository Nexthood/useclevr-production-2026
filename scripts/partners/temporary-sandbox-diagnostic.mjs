import assert from "node:assert/strict";
import {
  readFileSync,
  writeFileSync,
  appendFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";

const names = [
  "RAILWAY_API_TOKEN",
  "RAILWAY_TOKEN",
  "DATABASE_URL",
  "DIRECT_URL",
  "DROPBOX_SIGN_API_KEY",
  "DROPBOX_SIGN_ACCOUNT_ID",
  "DROPBOX_SIGN_CLIENT_ID",
  "PARTNER_CONTRACT_TEST_RECIPIENTS",
  "PARTNER_CONTRACT_ENCRYPTION_KEY_ID",
  "PARTNER_CONTRACT_ENCRYPTION_KEYS",
  "PARTNER_CONTRACT_OWNER_USER_IDS",
  "PARTNER_CONTRACT_COMPANY_SIGNER_REFS",
  "PARTNER_CONTRACT_PUBLIC_ORIGIN",
  "PARTNER_CONTRACT_WORKER_SECRET",
  "RESEND_API_KEY",
  "EMAIL_FROM",
];
const pass = (reason) => ({ status: "PASS", reason });
const blocked = (reason) => ({ status: "BLOCKED", reason });
function compareTargets(beta, production) {
  if (
    !beta?.authoritative ||
    !production?.authoritative ||
    !beta.databaseIdentifier ||
    !production.databaseIdentifier
  )
    return blocked(
      "Authoritative beta and production database identifiers are unavailable to this job.",
    );
  if (beta.databaseIdentifier === production.databaseIdentifier)
    return blocked("The supplied authoritative identifiers designate the same database.");
  return pass("Authoritative database identifiers differ.");
}
function presenceFlags(environment) {
  return Object.fromEntries(
    names.map((name) => {
      const flag = environment[`PRESENT_${name}`] || "false";
      if (flag !== "true" && flag !== "false") throw new Error("Presence flags must be booleans");
      return [name, flag === "true"];
    }),
  );
}
async function readRuntime(migration) {
  if (!process.env.RAILWAY_API_TOKEN && !process.env.RAILWAY_TOKEN)
    return {
      status: "BLOCKED",
      reason: "No existing Railway read-only credential is delegated to this Actions job.",
      beta: null,
      production: null,
    };
  const directory = mkdtempSync(path.join(os.tmpdir(), "pr420-readonly-"));
  const wrapper = fileURLToPath(new URL("../server/railway/railway.cjs", import.meta.url));
  const probe = fileURLToPath(new URL("./temporary-sandbox-probe.cjs", import.meta.url));
  function run(args, extra = {}, preload = false) {
    const result = spawnSync(
      process.execPath,
      [...(preload ? ["-r", probe] : []), wrapper, ...args],
      { cwd: directory, env: { ...process.env, ...extra }, encoding: "utf8", timeout: 60000 },
    );
    if (result.error || result.status !== 0)
      throw new Error("Runtime read-only access unavailable");
    return result.stdout;
  }
  try {
    mkdirSync(path.join(directory, ".railway"));
    writeFileSync(
      path.join(directory, ".railway/project.json"),
      JSON.stringify({ projectId: "0221314e-56bd-4438-829f-ae9e1cf03c0b" }),
    );
    const metadata = JSON.parse(run(["inspect", "--json"]));
    function findTarget(domain) {
      const targets = metadata.services.flatMap((service) =>
        service.instances
          .filter((instance) => instance.customDomains.some((entry) => entry.domain === domain))
          .map((instance) => ({ serviceId: service.id, environmentId: instance.environmentId })),
      );
      if (targets.length !== 1) throw new Error("Target mapping not unique");
      return targets[0];
    }
    const betaTarget = findTarget("test.useclevr.com");
    const productionTarget = findTarget("app.useclevr.com");
    if (
      betaTarget.serviceId !== "22dcb858-f0c0-426a-bc85-69766813372e" ||
      betaTarget.serviceId === productionTarget.serviceId
    )
      throw new Error("Target mapping invalid");
    const scopes = {};
    for (const [scope, target] of [
      ["beta", betaTarget],
      ["production", productionTarget],
    ]) {
      const output = path.join(directory, `${scope}.json`);
      run(
        [
          "variable",
          "list",
          "--environment",
          target.environmentId,
          "--service",
          target.serviceId,
          "--presence-only",
        ],
        {
          PR420_DIAGNOSTIC_SCOPE: scope,
          PR420_DIAGNOSTIC_OUTPUT: output,
          PR420_DIAGNOSTIC_NAMES: JSON.stringify(names),
          PR420_DIAGNOSTIC_TABLES: JSON.stringify(migration.declared_tables),
        },
        true,
      );
      scopes[scope] = JSON.parse(readFileSync(output, "utf8"));
    }
    return { status: "PASS", ...scopes };
  } catch {
    return {
      status: "BLOCKED",
      reason:
        "Existing credential could not establish approved read-only runtime metadata access. Raw errors and variable values are withheld.",
      beta: null,
      production: null,
    };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
function buildReport(
  presence,
  health,
  migration,
  runtime = { status: "BLOCKED", beta: null, production: null },
) {
  // Service IDs and healthy connections are not database isolation evidence.
  // No runtime database identifiers are exported by the existing CI/CD interface.
  const isolation = compareTargets(runtime.beta?.database, runtime.production?.database);
  if (
    runtime.beta &&
    (!runtime.beta.connection_targets_consistent ||
      !runtime.production?.connection_targets_consistent)
  )
    Object.assign(isolation, blocked("Read/write target consistency is not established."));
  const signingDisabled =
    health.revision === "4f2f43f7f484a8c17f6a0476464d6ac5f19aab1a" && health.signing === "disabled";
  const sourceUnavailable =
    "Actions context is not a Railway runtime configuration export; hosted presence is unverified, not established as absent.";
  const configured = (required) =>
    !runtime.beta
      ? blocked(sourceUnavailable)
      : required.every((name) => runtime.beta.presence[name])
        ? pass("Required names are present in the read-only TEST runtime export; values withheld.")
        : blocked(
            "Required names are missing or unavailable in the TEST runtime export; values withheld.",
          );
  const provider = configured([
    "DROPBOX_SIGN_API_KEY",
    "DROPBOX_SIGN_ACCOUNT_ID",
    "DROPBOX_SIGN_CLIENT_ID",
  ]);
  const email = configured(["RESEND_API_KEY", "EMAIL_FROM"]);
  const encryption = configured([
    "PARTNER_CONTRACT_ENCRYPTION_KEY_ID",
    "PARTNER_CONTRACT_ENCRYPTION_KEYS",
  ]);
  if (encryption.status === "PASS" && !runtime.beta.encryption_key_valid)
    Object.assign(
      encryption,
      blocked("The configured encryption key reference is not a valid 32-byte key."),
    );
  const webhook = configured([
    "DROPBOX_SIGN_API_KEY",
    "DROPBOX_SIGN_ACCOUNT_ID",
    "DROPBOX_SIGN_CLIENT_ID",
    "PARTNER_CONTRACT_PUBLIC_ORIGIN",
  ]);
  return {
    schema_version: 1,
    overall_status:
      isolation.status === "PASS" && signingDisabled &&
      [provider, email, encryption, webhook].every((check) => check.status === "PASS") &&
      runtime.beta?.distinct_configured_test_recipient_count >= 2
        ? "PASS" : "BLOCKED",
    mode: "temporary_read_only_actions_diagnostic",
    configuration_source:
      "Presence flags for Actions context; an existing delegated Railway credential, if available, is consumed only by the read-only wrapper and never printed.",
    runtime_metadata: runtime,
    runner_configuration_presence: presence,
    database_isolation: isolation,
    database_identifier_comparison: {
      beta: runtime.beta?.database?.databaseIdentifier || null,
      production: runtime.production?.database?.databaseIdentifier || null,
      authoritative: Boolean(
        runtime.beta?.database?.authoritative && runtime.production?.database?.authoritative,
      ),
    },
    required_authorization:
      "An existing approved read-only runtime metadata export or identity must be delegated to Actions before hosted database identity/configuration can be inspected. Local Railway CLI authentication is not required. No credential is created or requested by this job.",
    signing: {
      disabled_on_verified_test_revision: signingDisabled
        ? pass("Exact deployed revision reports signing disabled.")
        : blocked("Expected signing-disabled deployment is not confirmed."),
      hosted_provider_configuration: provider,
      hosted_email_configuration: email,
      hosted_encryption_configuration: encryption,
      hosted_webhook_configuration: webhook,
      webhook_source_contract:
        "Full JSON Content-Sha256 HMAC plus event hash, account/app binding and replay checks use the provider API key; there is no separate provider webhook-secret variable.",
      invitations_sent: 0,
    },
    migrations: {
      status: "BLOCKED",
      source_candidate: migration,
      hosted_pending_versions: null,
      reason:
        "Pending versions require read-only hosted catalog/ledger evidence. Source files and skipped predeploy do not establish the hosted schema state.",
      execution_allowed: false,
      beta_schema_markers: runtime.beta?.database?.migration_schema_tables_present || null,
      executed: [],
      production_modified: false,
    },
    qa_recipients: {
      status: runtime.beta?.distinct_configured_test_recipient_count >= 2 ? "PASS" : "BLOCKED",
      distinct_address_count: runtime.beta?.distinct_configured_test_recipient_count ?? null,
      reason: runtime.beta
        ? "Configured distinct allowlist count only; mailbox ownership and signer role authorization are not inferred."
        : "The hosted allowlist and signer role bindings are not exported to this job. No mailbox absence, ownership or authorization is inferred.",
      addresses_disclosed: false,
    },
    hosted_health: health,
    controls: {
      allowed_network_operations: [
        "GET test health",
        "read-only queries through established Railway wrapper if delegated",
        "BEGIN READ ONLY and SELECT catalog/identity metadata if delegated",
      ],
      runtime_database_connections_attempted: runtime.beta !== null || runtime.production !== null,
      configuration_mutations: 0,
      partner_activations: 0,
      commissions_created: 0,
      payouts_created: 0,
      diagnostic_ref: "feat/partner-contract-lifecycle",
      deployment_triggered_by_diagnostic: false,
    },
  };
}
async function readHealth() {
  try {
    const response = await fetch("https://test.useclevr.com/api/health", {
      method: "GET",
      redirect: "error",
      headers: { "Cache-Control": "no-cache" },
      signal: AbortSignal.timeout(12000),
    });
    const data = await response.json();
    const revision = response.headers.get("x-useclevr-test-revision");
    return {
      http_status: response.status,
      revision: /^[a-f0-9]{40}$/.test(revision || "") ? revision : null,
      signing:
        response.headers.get("x-useclevr-contract-signing") === "disabled"
          ? "disabled"
          : "unverified",
      database: ["healthy", "degraded", "unavailable"].includes(data.database)
        ? data.database
        : "unverified",
    };
  } catch {
    return { http_status: null, revision: null, signing: "unverified", database: "unverified" };
  }
}
if (process.argv.includes("--self-test")) {
  assert.equal(compareTargets(null, null).status, "BLOCKED");
  assert.equal(
    compareTargets({ authoritative: true, databaseIdentifier: "fixture-a" }, null).status,
    "BLOCKED",
  );
  assert.equal(
    compareTargets(
      { authoritative: false, databaseIdentifier: "fixture-a" },
      { authoritative: true, databaseIdentifier: "fixture-b" },
    ).status,
    "BLOCKED",
  );
  assert.equal(
    compareTargets(
      { authoritative: true, databaseIdentifier: "fixture-a" },
      { authoritative: true, databaseIdentifier: "fixture-a" },
    ).status,
    "BLOCKED",
  );
  assert.equal(
    compareTargets(
      { authoritative: true, databaseIdentifier: "fixture-a" },
      { authoritative: true, databaseIdentifier: "fixture-b" },
    ).status,
    "PASS",
  );
  assert.throws(() => presenceFlags({ PRESENT_DATABASE_URL: "VALUE_MUST_NOT_LEAK" }));
  const report = buildReport(
    presenceFlags({}),
    { revision: "4f2f43f7f484a8c17f6a0476464d6ac5f19aab1a", signing: "disabled" },
    { version: "0043" },
  );
  assert.equal(report.overall_status, "BLOCKED");
  assert.equal(report.migrations.execution_allowed, false);
  assert.equal(report.qa_recipients.distinct_address_count, null);
  assert.equal(report.signing.disabled_on_verified_test_revision.status, "PASS");
  assert.equal(report.controls.runtime_database_connections_attempted, false);
  assert.equal(
    buildReport(presenceFlags({}), { revision: "unverified", signing: "disabled" }, {}).signing
      .disabled_on_verified_test_revision.status,
    "BLOCKED",
  );
  console.info(
    "PASS read-only diagnostic rejects missing/untrusted/identical identities, refuses non-boolean presence inputs, withholds migrations and discloses no recipients",
  );
} else {
  const file = "src/lib/db/migrations/0043_partner_contracts.sql";
  const bytes = readFileSync(file);
  const migration = {
    version: "0043",
    file,
    source_sha256: createHash("sha256").update(bytes).digest("hex"),
    declared_tables: [
      ...bytes.toString().matchAll(/CREATE TABLE IF NOT EXISTS "([A-Za-z_][A-Za-z0-9_]*)"/g),
    ].map((match) => match[1]),
    state: "SOURCE_CANDIDATE_ONLY_HOSTED_STATE_UNKNOWN",
  };
  const runtime = await readRuntime(migration);
  const report = buildReport(presenceFlags(process.env), await readHealth(), migration, runtime);
  writeFileSync("pr420-sandbox-diagnostic.json", JSON.stringify(report, null, 2) + "\n");
  console.info("PR420_DIAGNOSTIC_JSON=" + JSON.stringify(report));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(
      process.env.GITHUB_STEP_SUMMARY,
      "# PR #420 sandbox diagnostic: BLOCKED\n\n" +
        "| Check | Result |\n| --- | --- |\n" +
        `| Deployed signing disabled | ${report.signing.disabled_on_verified_test_revision.status} |\n` +
        "| Database isolation | BLOCKED: no authoritative database identifiers exposed to Actions |\n" +
        "| Provider, mail, encryption and webhook runtime configuration | BLOCKED: no runtime export |\n" +
        "| Pending hosted migrations | UNKNOWN; migration execution refused |\n" +
        "| Two authorized QA recipients | BLOCKED: allowlist/roles unavailable |\n\n" +
        "Only read-only identity/catalog SQL is permitted when existing access is delegated. No schema change, invitation, activation or financial write occurs. " +
        "Actions presence flags do not establish absence in Railway. Local CLI login is not required.\n\n" +
        "```json\n" +
        JSON.stringify(report, null, 2) +
        "\n```\n",
    );
  process.exitCode = 1;
}

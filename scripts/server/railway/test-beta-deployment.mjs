import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import yaml from "js-yaml";

const require = createRequire(import.meta.url);
const { applyTestDeploymentPolicy } = require("../../runtime/partner-contract-test-policy.cjs");
const workflow = yaml.load(
  readFileSync(new URL("../../../.github/workflows/beta-maintenance.yml", import.meta.url), "utf8"),
);
assert.equal(workflow.on.workflow_dispatch.inputs.promote_to_production.default, false);
assert.equal(
  workflow.jobs["ensure-beta-pr"].if,
  "github.event_name == 'workflow_dispatch' && inputs.promote_to_production == true",
);
assert.deepEqual(workflow.on.push.branches, ["beta"]);
assert.equal(
  workflow.jobs["publish-dist-test"].steps.find((s) => s.name === "Checkout source").with.ref,
  "beta",
);
const stage = workflow.jobs["publish-dist-test"].steps.find(
  (s) => s.name === "Stage generated output",
).run;
assert.match(stage, /partner-contract-test-deploy\.json/);
assert.match(stage, /execFileSync\('git', \['rev-parse', 'HEAD'\]/);

const directory = mkdtempSync(path.join(os.tmpdir(), "beta-deploy-policy-"));
try {
  const unchanged = { PARTNER_CONTRACT_SIGNING_MODE: "dropbox_live" };
  assert.equal(applyTestDeploymentPolicy(directory, unchanged), false);
  assert.equal(unchanged.PARTNER_CONTRACT_SIGNING_MODE, "dropbox_live");
  mkdirSync(path.join(directory, "data-config"));
  const marker = path.join(directory, "data-config", "partner-contract-test-deploy.json");
  const policy = {
    environmentId: "d34d75b1-0d5c-45fa-b4e0-f2533c22a827",
    sourceRevision: "a".repeat(40),
  };
  writeFileSync(marker, JSON.stringify(policy));
  assert.throws(() =>
    applyTestDeploymentPolicy(directory, { RAILWAY_ENVIRONMENT_ID: "production-fixture" }),
  );
  assert.throws(() => applyTestDeploymentPolicy(directory, {}));
  const environment = {
    RAILWAY_ENVIRONMENT_ID: policy.environmentId,
    PARTNER_CONTRACTS_ENABLED: "true",
    PARTNER_CONTRACT_SIGNING_MODE: "dropbox_live",
    PARTNER_CONTRACT_LIVE_ENABLED: "true",
    PARTNER_CONTRACT_WORKER_ENABLED: "true",
  };
  assert.equal(applyTestDeploymentPolicy(directory, environment), true);
  assert.equal(environment.PARTNER_CONTRACTS_ENABLED, "false");
  assert.equal(environment.PARTNER_CONTRACT_SIGNING_MODE, "draft");
  assert.equal(environment.PARTNER_CONTRACT_LIVE_ENABLED, "false");
  assert.equal(environment.PARTNER_CONTRACT_WORKER_ENABLED, "false");
  assert.equal(environment.USECLEVR_TEST_SOURCE_REVISION, policy.sourceRevision);
  writeFileSync(marker, JSON.stringify({ ...policy, sourceRevision: "invalid" }));
  assert.throws(() => applyTestDeploymentPolicy(directory, environment));
  console.info(
    "PASS beta publishing requires explicit production promotion and test bundles disable contract sends before predeploy/start",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}

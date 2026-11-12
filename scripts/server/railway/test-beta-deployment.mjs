import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
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
assert.doesNotMatch(stage, /environmentId/);
assert.match(stage, /serviceId: '22dcb858-f0c0-426a-bc85-69766813372e'/);
assert.match(stage, /execFileSync\('git', \['rev-parse', 'HEAD'\]/);

const directory = mkdtempSync(path.join(os.tmpdir(), "beta-deploy-policy-"));
try {
  const unchanged = { PARTNER_CONTRACT_SIGNING_MODE: "dropbox_live" };
  assert.equal(applyTestDeploymentPolicy(directory, unchanged), false);
  assert.equal(unchanged.PARTNER_CONTRACT_SIGNING_MODE, "dropbox_live");
  mkdirSync(path.join(directory, "data-config"));
  const marker = path.join(directory, "data-config", "partner-contract-test-deploy.json");
  const policy = {
    serviceId: "22dcb858-f0c0-426a-bc85-69766813372e",
    sourceRevision: "a".repeat(40),
  };
  const productionEnvironmentId = "production-environment-fixture";
  // Environment-free markers support TEST independently of Railway environment placement.
  writeFileSync(marker, JSON.stringify(policy));
  for (const environmentId of ["test-environment-fixture", productionEnvironmentId, undefined]) {
    assert.equal(
      applyTestDeploymentPolicy(directory, {
        RAILWAY_ENVIRONMENT_ID: environmentId,
        RAILWAY_SERVICE_ID: policy.serviceId,
      }),
      true,
    );
    assert.throws(() =>
      applyTestDeploymentPolicy(directory, {
        RAILWAY_ENVIRONMENT_ID: environmentId,
        RAILWAY_SERVICE_ID: "different-service-fixture",
      }),
    );
  }
  // Older markers may include environment metadata; it grants no extra authority.
  writeFileSync(marker, JSON.stringify({ ...policy, environmentId: "legacy-environment-fixture" }));
  assert.equal(
    applyTestDeploymentPolicy(directory, {
      RAILWAY_ENVIRONMENT_ID: productionEnvironmentId,
      RAILWAY_SERVICE_ID: policy.serviceId,
    }),
    true,
  );
  assert.throws(() => applyTestDeploymentPolicy(directory, {}));
  // A marker cannot authorize a different runtime service, even if both agree.
  writeFileSync(marker, JSON.stringify({ ...policy, serviceId: "different-service-fixture" }));
  assert.throws(() =>
    applyTestDeploymentPolicy(directory, {
      RAILWAY_ENVIRONMENT_ID: productionEnvironmentId,
      RAILWAY_SERVICE_ID: "different-service-fixture",
    }),
  );
  writeFileSync(marker, JSON.stringify(policy));
  const environment = {
    RAILWAY_ENVIRONMENT_ID: productionEnvironmentId,
    RAILWAY_SERVICE_ID: policy.serviceId,
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
  const predeploy = spawnSync(
    process.execPath,
    [
      "-e",
      `
      const Module = require('node:module');
      const load = Module._load;
      Module._load = function(id, ...args) {
        if (id === 'pg') return { Client: class { constructor() { throw new Error('Unexpected database access'); } } };
        return load.call(this, id, ...args);
      };
      require(process.argv[1]);
    `,
      require.resolve("../../runtime/railway-predeploy.cjs"),
    ],
    {
      cwd: directory,
      env: {
        PATH: process.env.PATH,
        RAILWAY_ENVIRONMENT_ID: productionEnvironmentId,
        RAILWAY_SERVICE_ID: policy.serviceId,
      },
      encoding: "utf8",
      timeout: 10000,
    },
  );
  assert.ifError(predeploy.error);
  assert.equal(predeploy.status, 0, predeploy.stderr);
  assert.match(predeploy.stdout, /Hosted migrations skipped by TEST artifact policy/);
  writeFileSync(marker, JSON.stringify({ ...policy, sourceRevision: "invalid" }));
  assert.throws(() => applyTestDeploymentPolicy(directory, environment));
  console.info(
    "PASS beta publishing requires explicit production promotion and test bundles disable contract sends before predeploy/start",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}

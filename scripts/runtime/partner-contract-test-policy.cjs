const fs = require("node:fs");
const path = require("node:path");

// Only the beta publisher creates this marker. Production bundles have none.
function applyTestDeploymentPolicy(directory = process.cwd(), environment = process.env) {
  const marker = path.join(directory, "data-config", "partner-contract-test-deploy.json");
  if (!fs.existsSync(marker)) return false;
  const policy = JSON.parse(fs.readFileSync(marker, "utf8"));
  if (
    policy.environmentId !== "7e93cd17-12a0-4a0f-b345-9ef8ae3c6b8e" ||
    policy.serviceId !== "22dcb858-f0c0-426a-bc85-69766813372e" ||
    environment.RAILWAY_ENVIRONMENT_ID !== policy.environmentId ||
    environment.RAILWAY_SERVICE_ID !== policy.serviceId ||
    !/^[a-f0-9]{40}$/.test(policy.sourceRevision || "")
  )
    throw new Error("Contract test bundle requires the identified Railway TEST service");
  environment.PARTNER_CONTRACTS_ENABLED = "false";
  environment.PARTNER_CONTRACT_SIGNING_MODE = "draft";
  environment.PARTNER_CONTRACT_LIVE_ENABLED = "false";
  environment.PARTNER_CONTRACT_WORKER_ENABLED = "false";
  environment.USECLEVR_TEST_SOURCE_REVISION = policy.sourceRevision;
  console.info(
    `[partner-contract-test] source=${policy.sourceRevision} signing=draft contracts=false live=false worker=false databaseIsolation=unverified`,
  );
  return true;
}

module.exports = { applyTestDeploymentPolicy };

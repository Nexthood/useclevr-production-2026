const { execSync } = require("node:child_process");
const fs = require("node:fs");

const APPROVED_RESIDUAL_IDS = new Set([
  "GHSA-36jr-mh4h-2g58",
  "GHSA-jg8r-5jh2-v2xj",
]);

function runAudit() {
  try {
    const output = execSync("pnpm audit --json", {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return JSON.parse(output);
  } catch (error) {
    const message = error.stderr ? error.stderr.toString() : error.message;
    if (error.stdout) {
      try {
        return JSON.parse(error.stdout.toString());
      } catch {
        console.error("Audit JSON parse failed:", message);
        process.exit(1);
      }
    }
    console.error("Audit command failed:", message);
    process.exit(1);
  }
}

function main() {
  const data = runAudit();
  const advisories = data.advisories || {};
  const metadata = data.metadata || {};
  const totalVulnerabilities = metadata.vulnerabilities || {
    critical: 0,
    high: 0,
    moderate: 0,
    low: 0,
  };

  let unapprovedCritical = 0;
  let unapprovedHigh = 0;
  let unapprovedModerate = 0;
  let unapprovedLow = 0;
  const unapproved = [];
  const approved = [];

  for (const [key, advisory] of Object.entries(advisories)) {
    const ghsa = advisory.github_advisory_id || "";
    if (APPROVED_RESIDUAL_IDS.has(ghsa)) {
      approved.push({
        id: advisory.id,
        ghsa,
        title: advisory.title,
        module: advisory.module_name,
        severity: advisory.severity,
      });
      continue;
    }

    const severity = advisory.severity || "unknown";
    if (severity === "critical") unapprovedCritical++;
    else if (severity === "high") unapprovedHigh++;
    else if (severity === "moderate") unapprovedModerate++;
    else if (severity === "low") unapprovedLow++;

    unapproved.push({
      id: advisory.id,
      ghsa,
      title: advisory.title,
      module: advisory.module_name,
      severity,
      vulnerable_versions: advisory.vulnerable_versions,
      patched_versions: advisory.patched_versions,
    });
  }

  console.log("=== Approved Residual Advisories ===");
  for (const item of approved) {
    console.log(`[${item.severity.toUpperCase()}] ${item.ghsa}: ${item.title} (${item.module})`);
  }
  console.log(`Approved residual count: ${approved.length}`);

  console.log("\n=== Unapproved Advisories ===");
  if (unapproved.length === 0) {
    console.log("None. Audit passes with approved residual allowlist.");
  } else {
    for (const item of unapproved) {
      console.log(
        `[${item.severity.toUpperCase()}] ${item.ghsa || "no-ghsa"}: ${item.title} (${item.module})`,
      );
      console.log(`  vulnerable: ${item.vulnerable_versions} | patched: ${item.patched_versions}`);
    }
    console.log(`\nUnapproved counts: critical=${unapprovedCritical} high=${unapprovedHigh} moderate=${unapprovedModerate} low=${unapprovedLow}`);
  }

  const hasUnapprovedHighOrCritical = unapprovedCritical > 0 || unapprovedHigh > 0;
  if (hasUnapprovedHighOrCritical) {
    console.error("\nAudit FAILED: unapproved Critical/High advisories detected.");
    process.exit(1);
  }

  console.log("\nAudit PASSED: no unapproved Critical or High advisories.");
  process.exit(0);
}

main();

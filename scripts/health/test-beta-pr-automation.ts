import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflowsDir = ".github/workflows";

function readWorkflow(fileName: string) {
  return readFileSync(`${workflowsDir}/${fileName}`, "utf8");
}

function testBetaMaintenanceCreatesExactPr() {
  const workflow = readWorkflow("beta-maintenance.yml");

  assert.match(
    workflow,
    /push:\s*\n\s*branches:\s*\[beta\]/,
    "beta-maintenance must trigger on beta pushes",
  );

  assert.match(workflow, /ensure-beta-pr:/, "beta-maintenance must define the ensure-beta-pr job");
  assert.match(
    workflow,
    /ensure-beta-pr:\s*\n\s*name: Ensure beta to main pull request\s*\n\s*needs: publish-dist-test/,
    "PR automation must run only after the dist-test publish succeeds",
  );
  assert.match(
    workflow,
    /ensure-beta-pr:[\s\S]*?permissions:\s*\n\s*contents: read\s*\n\s*pull-requests: write\s*\n\s*actions: write/,
    "PR automation needs PR write and workflow dispatch, but must not gain code push rights",
  );
  assert.match(
    workflow,
    /Beta PR automation requires a beta branch push or a confirmed dispatch\./,
    "PR automation must stay gated to beta pushes or confirmed dispatches",
  );

  assert.match(
    workflow,
    /gh pr list --repo "\$REPO" --base main --head beta --state open/,
    "PR lookup must use the exact base and head",
  );
  assert.match(
    workflow,
    /select\(\.headRefName == "beta" and \.baseRefName == "main"\)/,
    "PR lookup must re-validate both refs so unrelated open PRs can never match",
  );
  assert.match(
    workflow,
    /gh pr create --repo "\$REPO" --base main --head beta/,
    "a missing beta -> main PR must be created automatically",
  );
  assert.match(
    workflow,
    /gh pr edit "\$pr_number" --repo "\$REPO" --body-file/,
    "an existing beta -> main PR must be updated instead of duplicated",
  );
  assert.match(
    workflow,
    /gh workflow run branch-maintenance\.yml --ref main --repo "\$REPO"/,
    "a merged PR must dispatch the production dist publish",
  );
  assert.match(
    workflow,
    /gh pr merge "\$PR_NUMBER" --repo "\$REPO" --merge/,
    "automation must merge the exact beta -> main PR after checks pass",
  );
  assert.match(workflow, /\{1\.\.60\}/, "merge wait must tolerate a full validation run");
  assert.match(
    workflow,
    /Timeout: required checks did not pass within 20 minutes/,
    "unmergeable PRs must fail the workflow visibly instead of stalling",
  );
  assert.doesNotMatch(workflow, /--state all/, "PR lookup must target open PRs only");
  assert.ok(!workflow.includes("#300"), "automation must never hardcode PR numbers");
}

function testAutoMergeOnlyMatchesBetaToMain() {
  const workflow = readWorkflow("auto-merge.yml");

  assert.match(
    workflow,
    /pull_request:\s*\n\s*branches:\s*\[main\]/,
    "auto-merge must only watch PRs into main",
  );
  assert.match(
    workflow,
    /head\.ref == 'beta' &&\s*\n\s*github\.event\.pull_request\.base\.ref == 'main' &&\s*\n\s*github\.event\.pull_request\.draft == false/,
    "auto-merge must require the exact beta -> main refs and a non-draft PR",
  );
  assert.match(workflow, /for i in \{1\.\.80\}/, "wait window must cover a full validation run");
  assert.match(workflow, /attempt \$i\/80/, "wait window messages must match the loop bounds");
  assert.match(
    workflow,
    /gh workflow run branch-maintenance\.yml --ref main/,
    "auto-merge must dispatch the production dist publish after merging",
  );
  assert.ok(!workflow.includes("#300"), "auto-merge must not reference specific PR numbers");
}

function testProductionPublishStaysMainGated() {
  const workflow = readWorkflow("branch-maintenance.yml");
  assert.match(
    workflow,
    /Dist publish is only allowed from main/,
    "production dist publish must stay main-only",
  );
  assert.match(
    workflow,
    /push:\s*\n\s*branches:\s*\[main\]/,
    "production dist publish must trigger from main pushes",
  );
}

async function main() {
  testBetaMaintenanceCreatesExactPr();
  testAutoMergeOnlyMatchesBetaToMain();
  testProductionPublishStaysMainGated();
  console.log("Beta to main PR automation regression tests passed.");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

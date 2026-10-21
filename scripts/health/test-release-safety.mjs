import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import yaml from "js-yaml";
import { productionEnvironment, verifyProductionApproval } from "./production-approval-policy.mjs";

export async function runWorkflowSafetyTests() {
  const read = (name) => readFileSync(`.github/workflows/${name}`, "utf8");
  const betaSource = read("beta-maintenance.yml");
  const beta = yaml.load(betaSource);
  assert.deepEqual(beta.on.push.branches, ["beta"]);
  assert.equal(beta.jobs["ensure-beta-pr"].needs, "publish-dist-test");
  assert.deepEqual(beta.jobs["ensure-beta-pr"].permissions, {
    contents: "read",
    "pull-requests": "write",
  });
  assert.match(betaSource, /git push origin new-dist-test:dist-test --force/);
  assert.match(betaSource, /gh pr create --repo "\$REPO" --base main --head beta/);
  assert.match(betaSource, /gh pr edit "\$pr_number" --repo "\$REPO" --body-file/);
  assert.match(betaSource, /select\(\.headRefName == "beta" and \.baseRefName == "main"\)/);
  assert.ok(beta.jobs["publish-dist-test"].steps.some((step) => step.run === "pnpm prod:build"));
  assert.ok(
    beta.jobs["publish-dist-test"].steps.some(
      (step) => step.name === "Smoke test generated server",
    ),
  );
  for (const name of ["beta-maintenance.yml", "auto-merge.yml"]) {
    const source = read(name);
    assert.doesNotMatch(
      source,
      /gh pr merge|gh workflow run|--auto\b|pulls\.merge|createWorkflowDispatch/,
    );
  }
  const title = yaml.load(read("auto-merge.yml"));
  assert.deepEqual(title.permissions, { contents: "read", "pull-requests": "write" });
  assert.match(title.jobs["auto-merge"].if, /head.ref == 'beta'/);
  assert.match(title.jobs["auto-merge"].if, /draft == false/);
  assert.equal(title.jobs["auto-merge"].steps.length, 1);
  assert.match(title.jobs["auto-merge"].steps[0].run, /gh pr edit/);
  console.log(
    "PASS beta builds/publication/PR preparation remain; both promotion paths lack merge and dispatch rights",
  );

  const production = yaml.load(read("branch-maintenance.yml"));
  assert.deepEqual(production.on.push.branches, ["main"]);
  const preflight = production.jobs["verify-approval-policy"];
  const publish = production.jobs["publish-dist"];
  assert.equal(publish.needs, "verify-approval-policy");
  assert.equal(publish.environment, productionEnvironment);
  assert.equal(preflight.environment, undefined);
  assert.equal(preflight.permissions.contents, "read");
  assert.equal(publish.permissions.contents, "write");
  for (const job of [preflight, publish]) {
    const checkouts = job.steps.filter((step) => step.uses?.startsWith("actions/checkout@"));
    assert.ok(checkouts.length);
    for (const checkout of checkouts) assert.equal(checkout.with.ref, "${{ github.sha }}");
    assert.ok(
      job.steps.some((step) =>
        step.with?.script?.includes("verifyProductionApproval(github, context.repo)"),
      ),
    );
  }
  assert.match(preflight.steps.at(-1).with.script, /context.ref !== 'refs\/heads\/main'/);
  assert.ok(
    publish.steps.findIndex(
      (step) => step.name === "Recheck production protection after approval",
    ) < publish.steps.findIndex((step) => step.name === "Install dependencies"),
  );
  assert.doesNotMatch(
    readFileSync("scripts/package-dist/create-dist.cjs", "utf8"),
    /RUN node scripts\/runtime\/railway-predeploy\.cjs/,
  );
  console.log(
    "PASS production requires protected environment, preflight, post-approval recheck, exact SHA, and predeploy-only database work",
  );

  const approved = {
    name: productionEnvironment,
    can_admins_bypass: false,
    protection_rules: [
      {
        type: "required_reviewers",
        prevent_self_review: true,
        reviewers: [{ type: "User", reviewer: { type: "User" } }],
      },
    ],
    deployment_branch_policy: { protected_branches: false, custom_branch_policies: true },
  };
  const branch = { total_count: 1, branch_policies: [{ name: "main", type: "branch" }] };
  const check = (environment, policies = branch) =>
    verifyProductionApproval(
      {
        rest: {
          repos: {
            getEnvironment: async () => ({ data: environment }),
            listDeploymentBranchPolicies: async () => ({ data: policies }),
          },
        },
      },
      { owner: "fixture", repo: "fixture" },
    );
  await check(approved);
  for (const mutate of [
    (e) => {
      e.name = "another-environment";
    },
    (e) => {
      delete e.can_admins_bypass;
    },
    (e) => {
      e.can_admins_bypass = true;
    },
    (e) => {
      e.protection_rules = [];
    },
    (e) => {
      e.protection_rules[0].prevent_self_review = false;
    },
    (e) => {
      e.protection_rules[0].reviewers = [];
    },
    (e) => {
      e.protection_rules[0].reviewers[0].reviewer.type = "Bot";
    },
    (e) => {
      e.protection_rules[0].reviewers[0].type = "Team";
    },
    (e) => {
      e.deployment_branch_policy = null;
    },
  ]) {
    const invalid = structuredClone(approved);
    mutate(invalid);
    await assert.rejects(check(invalid));
  }
  for (const policies of [
    { total_count: 0, branch_policies: [] },
    { total_count: 2, branch_policies: branch.branch_policies },
    { total_count: 1, branch_policies: [{ name: "*", type: "branch" }] },
    { total_count: 1, branch_policies: [{ name: "main", type: "tag" }] },
  ])
    await assert.rejects(check(approved, policies));
  await assert.rejects(
    verifyProductionApproval(
      {
        rest: {
          repos: {
            getEnvironment: async () => {
              throw new Error("404");
            },
          },
        },
      },
      { owner: "fixture", repo: "fixture" },
    ),
  );
  console.log(
    "PASS missing, inaccessible, unprotected, bypassable, bot-reviewed, and broad-branch environments fail closed",
  );
}
